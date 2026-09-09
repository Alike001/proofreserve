import {Contract, EventLog, JsonRpcProvider, Wallet, getAddress} from "ethers";

import {assessPortfolio} from "./assess.js";
import {RiskAgentConfig} from "./agent-config.js";
import {PortfolioFeatures, RiskAssessment} from "./domain.js";
import {AcceptedFact, PortfolioSnapshot, buildPortfolioFeatures} from "./features.js";
import {GeminiClient} from "./gemini.js";

const EVIDENCE_ABI = [
  "function currentEpoch() view returns (uint64)",
  "function checkpointRoots(uint64 epoch) view returns (bytes32)",
  "function settledCount(uint64 epoch) view returns (uint64)",
  "function settledValue(uint64 epoch) view returns (uint256)",
  "function lateCount(uint64 epoch) view returns (uint64)",
  "function lateValue(uint64 epoch) view returns (uint256)",
  "function lossCount(uint64 epoch) view returns (uint64)",
  "function lossValue(uint64 epoch) view returns (uint256)",
  "event FactAccepted(bytes32 indexed queryId,uint8 indexed factType,bytes32 indexed obligationId,address borrower,bytes32 groupId,uint128 amount,uint64 occurredAt,uint64 epoch,uint64 sourceHeight,bytes32 evidenceRoot)",
  "event CheckpointAccepted(bytes32 indexed queryId,uint64 indexed epoch,bytes32 indexed factsRoot,uint64 factCount,uint64 sourceHeight,uint64 closedAt)"
];

const POOL_ABI = [
  "function totalManagedAssets() view returns (uint256)",
  "function totalCommitments() view returns (uint256)",
  "function totalPrincipalOutstanding() view returns (uint256)"
];

const CONTROLLER_ABI = [
  "function agent() view returns (address)",
  "function activeEpoch() view returns (uint64)",
  "function modelVersion() view returns (bytes32)",
  "function policyVersion() view returns (bytes32)",
  "function usedDecisions(bytes32 decisionHash) view returns (bool)",
  "function submitAssessment((uint8 regime,uint16 reserveBps,uint16 confidenceBps,uint64 epoch,bytes32 reasonCodesHash,bytes32 evidenceRoot,bytes32 featureHash,bytes32 modelVersion,bytes32 policyVersion,bytes32 decisionHash) assessment)"
];

export interface PreparedOnchainAssessment {
  observedBlock: number;
  features: PortfolioFeatures;
  assessment: RiskAssessment;
}

export interface AssessmentSubmission {
  transactionHash: string;
  blockNumber: number;
}

export class OnchainRiskAgent {
  private readonly provider: JsonRpcProvider;
  private readonly evidence: Contract;
  private readonly pool: Contract;

  constructor(private readonly config: RiskAgentConfig) {
    this.provider = new JsonRpcProvider(config.creditcoinRpcUrl);
    this.evidence = new Contract(config.evidenceRegistryAddress, EVIDENCE_ABI, this.provider);
    this.pool = new Contract(config.poolAddress, POOL_ABI, this.provider);
  }

  async prepare(requestedEpoch?: number): Promise<PreparedOnchainAssessment> {
    const observedBlock = await this.provider.getBlockNumber();
    const epoch = requestedEpoch ?? await this.latestClosedEpoch(observedBlock);
    if (!Number.isSafeInteger(epoch) || epoch <= 0) throw new Error("assessment epoch must be a positive integer");

    const features = await this.collectFeatures(epoch, observedBlock);
    const assessment = await assessPortfolio(
      features,
      new GeminiClient(this.config.geminiApiKey, this.config.geminiModel)
    );
    return {observedBlock, features, assessment};
  }

  async submit(prepared: PreparedOnchainAssessment): Promise<AssessmentSubmission> {
    if (!this.config.agentPrivateKey) throw new Error("RISK_AGENT_PRIVATE_KEY is required for submission");
    const signer = new Wallet(this.config.agentPrivateKey, this.provider);
    const controller = new Contract(this.config.reserveControllerAddress, CONTROLLER_ABI, signer);
    const signerAddress = await signer.getAddress();
    const [configuredAgent, activeEpoch, modelVersion, policyVersion, used] = await Promise.all([
      controller.getFunction("agent").staticCall(),
      controller.getFunction("activeEpoch").staticCall(),
      controller.getFunction("modelVersion").staticCall(),
      controller.getFunction("policyVersion").staticCall(),
      controller.getFunction("usedDecisions").staticCall(prepared.assessment.decisionHash)
    ]);

    if (getAddress(String(configuredAgent)) !== getAddress(signerAddress)) {
      throw new Error("configured risk signer is not the ReserveController agent");
    }
    if (BigInt(activeEpoch) > BigInt(prepared.assessment.epoch)) {
      throw new Error("assessment epoch is older than the controller's active epoch");
    }
    if (String(modelVersion).toLowerCase() !== prepared.assessment.modelVersion.toLowerCase()) {
      throw new Error("risk model version does not match ReserveController");
    }
    if (String(policyVersion).toLowerCase() !== prepared.assessment.policyVersion.toLowerCase()) {
      throw new Error("risk policy version does not match ReserveController");
    }
    if (Boolean(used)) throw new Error("assessment decision was already submitted");

    const tuple = controllerAssessmentTuple(prepared.assessment);
    const submitAssessment = controller.getFunction("submitAssessment");
    await submitAssessment.staticCall(tuple);
    const estimate = await submitAssessment.estimateGas(tuple);
    const transaction = await submitAssessment.send(tuple, {gasLimit: (estimate * 120n) / 100n});
    const receipt = await transaction.wait(this.config.confirmations);
    if (!receipt || receipt.status !== 1) throw new Error("Creditcoin assessment transaction failed");
    return {transactionHash: transaction.hash, blockNumber: receipt.blockNumber};
  }

  private async latestClosedEpoch(blockTag: number): Promise<number> {
    const currentEpoch = BigInt(await this.evidence.getFunction("currentEpoch").staticCall({blockTag}));
    if (currentEpoch <= 1n) throw new Error("no finalized evidence checkpoint is available");
    return safeNumber(currentEpoch - 1n, "latest closed epoch");
  }

  private async collectFeatures(epoch: number, blockTag: number): Promise<PortfolioFeatures> {
    const [
      evidenceRoot,
      settledCount,
      settledValue,
      lateCount,
      lateValue,
      lossCount,
      lossValue,
      managedAssets,
      commitments,
      principalOutstanding,
      factEvents,
      checkpointEvents,
      block
    ] = await Promise.all([
      this.evidence.getFunction("checkpointRoots").staticCall(epoch, {blockTag}),
      this.evidence.getFunction("settledCount").staticCall(epoch, {blockTag}),
      this.evidence.getFunction("settledValue").staticCall(epoch, {blockTag}),
      this.evidence.getFunction("lateCount").staticCall(epoch, {blockTag}),
      this.evidence.getFunction("lateValue").staticCall(epoch, {blockTag}),
      this.evidence.getFunction("lossCount").staticCall(epoch, {blockTag}),
      this.evidence.getFunction("lossValue").staticCall(epoch, {blockTag}),
      this.pool.getFunction("totalManagedAssets").staticCall({blockTag}),
      this.pool.getFunction("totalCommitments").staticCall({blockTag}),
      this.pool.getFunction("totalPrincipalOutstanding").staticCall({blockTag}),
      this.evidence.queryFilter(
        "FactAccepted",
        this.config.evidenceDeploymentBlock,
        blockTag
      ),
      this.evidence.queryFilter("CheckpointAccepted", this.config.evidenceDeploymentBlock, blockTag),
      this.provider.getBlock(blockTag)
    ]);

    if (!block) throw new Error(`Creditcoin block ${blockTag} was not found`);
    const matchingCheckpoints = checkpointEvents
      .map((event) => eventLog(event, "CheckpointAccepted"))
      .filter((event) => safeNumber(BigInt(event.args[1]), "checkpoint epoch") === epoch);
    if (matchingCheckpoints.length !== 1) {
      throw new Error(`expected one accepted checkpoint for epoch ${epoch}, found ${matchingCheckpoints.length}`);
    }
    const checkpoint = matchingCheckpoints[0]!;
    const epochFacts = factEvents
      .map((event) => eventLog(event, "FactAccepted"))
      .filter((event) => safeNumber(BigInt(event.args[7]), "fact epoch") === epoch)
      .sort((left, right) => left.blockNumber - right.blockNumber || left.index - right.index)
      .map((event): AcceptedFact => ({
        factType: safeNumber(BigInt(event.args[1]), "fact type"),
        borrower: String(event.args[3]),
        groupId: String(event.args[4]),
        amount: BigInt(event.args[5]).toString(),
        epoch: safeNumber(BigInt(event.args[7]), "fact epoch"),
        evidenceRoot: String(event.args[9])
      }));

    const snapshot: PortfolioSnapshot = {
      epoch,
      evidenceRoot: String(evidenceRoot),
      checkpointFactCount: safeNumber(BigInt(checkpoint.args[3]), "checkpoint fact count"),
      checkpointClosedAt: safeNumber(BigInt(checkpoint.args[5]), "checkpoint close time"),
      observedAt: block.timestamp,
      settledCount: safeNumber(BigInt(settledCount), "settled count"),
      settledValue: BigInt(settledValue).toString(),
      lateCount: safeNumber(BigInt(lateCount), "late count"),
      lateValue: BigInt(lateValue).toString(),
      lossCount: safeNumber(BigInt(lossCount), "loss count"),
      lossValue: BigInt(lossValue).toString(),
      totalManagedAssets: BigInt(managedAssets).toString(),
      totalCommitments: BigInt(commitments).toString(),
      totalPrincipalOutstanding: BigInt(principalOutstanding).toString()
    };
    return buildPortfolioFeatures(snapshot, epochFacts);
  }
}

export function controllerAssessmentTuple(assessment: RiskAssessment): Record<string, number | string> {
  return {
    regime: assessment.regimeIndex,
    reserveBps: assessment.reserveBps,
    confidenceBps: assessment.confidenceBps,
    epoch: assessment.epoch,
    reasonCodesHash: assessment.reasonCodesHash,
    evidenceRoot: assessment.evidenceRoot,
    featureHash: assessment.featureHash,
    modelVersion: assessment.modelVersion,
    policyVersion: assessment.policyVersion,
    decisionHash: assessment.decisionHash
  };
}

function eventLog(value: EventLog | unknown, name: string): EventLog {
  if (!(value instanceof EventLog)) throw new Error(`${name} query returned an undecoded log`);
  return value;
}

function safeNumber(value: bigint, label: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds safe integer range`);
  return Number(value);
}
