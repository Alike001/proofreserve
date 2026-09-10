import {readFile} from "node:fs/promises";

import {Contract, JsonRpcProvider, VoidSigner, formatUnits, getAddress, isError, parseUnits} from "ethers";

import type {PortfolioFeatures, RiskAssessment} from "../../risk/src/domain.js";
import {validateRiskAssessment} from "../../risk/src/assess.js";
import {deterministicBaseline} from "../../risk/src/policy.js";

const DEFAULT_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_CC3_RPC = "https://rpc.cc3-testnet.creditcoin.network";
const NORMAL_REFERENCE_BLOCK = 5_460_299;
const TEST_BORROWER = "0x000000000000000000000000000000000000B001";

const EVIDENCE_ABI = [
  "function processedQueries(bytes32 queryId) view returns (bool)",
  "function checkpointRoots(uint64 epoch) view returns (bytes32)",
  "function settledCount(uint64 epoch) view returns (uint64)",
  "function settledValue(uint64 epoch) view returns (uint256)",
  "function lateCount(uint64 epoch) view returns (uint64)",
  "function lateValue(uint64 epoch) view returns (uint256)",
  "function lossCount(uint64 epoch) view returns (uint64)",
  "function lossValue(uint64 epoch) view returns (uint256)"
];
const CONTROLLER_ABI = [
  "function activeRegime() view returns (uint8)",
  "function activeReserveBps() view returns (uint16)",
  "function activeEpoch() view returns (uint64)",
  "function activeEvidenceRoot() view returns (bytes32)",
  "function usedDecisions(bytes32 decisionHash) view returns (bool)"
];
const POOL_ABI = [
  "function owner() view returns (address)",
  "function totalManagedAssets() view returns (uint256)",
  "function totalCommitments() view returns (uint256)",
  "function lockedReserve() view returns (uint256)",
  "function lendable() view returns (uint256)",
  "function commitLoan(address borrower,uint256 amount)",
  "error InsufficientLendable(uint256 available,uint256 requested)"
];

interface ProofRecord {
  action: string;
  sourceTransactionHash: string;
  sourceBlock: number;
  queryId: string;
  creditcoinTransactionHash: string;
}

interface ProofManifest {
  schemaVersion: number;
  sourceChainId: number;
  creditcoinChainId: number;
  sourceLoanBook: string;
  evidenceRegistry: string;
  checkpointEpoch: number;
  checkpointRoot: string;
  proofs: ProofRecord[];
}

interface DeploymentManifest {
  chainId: number;
  contracts: {
    evidence: {address: string};
    controller: {address: string};
    pool: {address: string};
  };
}

interface RiskArtifact {
  observedBlock: number;
  features: PortfolioFeatures;
  assessment: RiskAssessment;
}

interface SubmissionArtifact extends RiskArtifact {
  submission: {transactionHash: string; blockNumber: number};
}

const checks: string[] = [];

function verify(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FAILED: ${label}`);
  checks.push(label);
  console.log(`✓ ${label}`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function sameAddress(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

async function contractAllows(
  pool: Contract,
  owner: string,
  amount: bigint,
  blockTag?: number
): Promise<boolean> {
  const asOwner = pool.connect(new VoidSigner(getAddress(owner), pool.runner?.provider)) as Contract;
  try {
    await asOwner.getFunction("commitLoan").staticCall(TEST_BORROWER, amount, blockTag === undefined ? {} : {blockTag});
    return true;
  } catch (error) {
    if (!isError(error, "CALL_EXCEPTION")) throw error;
    const parsed = error.revert ?? (error.data ? pool.interface.parseError(error.data) : null);
    if (parsed?.name !== "InsufficientLendable") throw error;
    return false;
  }
}

const [proofs, deployment, risk, submission] = await Promise.all([
  readJson<ProofManifest>("deployments/attestcoin-proofs-epoch-2.json"),
  readJson<DeploymentManifest>("deployments/cc3-testnet.json"),
  readJson<RiskArtifact>("deployments/risk-assessment-epoch-2.json"),
  readJson<SubmissionArtifact>("deployments/risk-submission-epoch-2.json")
]);

const sourceProvider = new JsonRpcProvider(process.env.SOURCE_CHAIN_RPC_URL?.trim() || DEFAULT_SEPOLIA_RPC);
const cc3Provider = new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL?.trim() || DEFAULT_CC3_RPC);
const [sourceNetwork, cc3Network] = await Promise.all([sourceProvider.getNetwork(), cc3Provider.getNetwork()]);
verify(Number(sourceNetwork.chainId) === proofs.sourceChainId, "connected to Ethereum Sepolia (11155111)");
verify(Number(cc3Network.chainId) === proofs.creditcoinChainId, "connected to Creditcoin CC3 (102031)");
verify(proofs.schemaVersion === 1 && proofs.proofs.length === 7, "epoch 2 lists six facts and one checkpoint");
verify(sameAddress(proofs.evidenceRegistry, deployment.contracts.evidence.address), "proof manifest targets the deployed evidence registry");

const evidence = new Contract(deployment.contracts.evidence.address, EVIDENCE_ABI, cc3Provider);
const controller = new Contract(deployment.contracts.controller.address, CONTROLLER_ABI, cc3Provider);
const pool = new Contract(deployment.contracts.pool.address, POOL_ABI, cc3Provider);

const receiptPairs = await Promise.all(
  proofs.proofs.map(async (proof) => ({
    proof,
    source: await sourceProvider.getTransactionReceipt(proof.sourceTransactionHash),
    acceptance: await cc3Provider.getTransactionReceipt(proof.creditcoinTransactionHash),
    processed: Boolean(await evidence.getFunction("processedQueries").staticCall(proof.queryId))
  }))
);

for (const {proof, source, acceptance, processed} of receiptPairs) {
  verify(source !== null && source.status === 1, `${proof.action}: Sepolia source transaction succeeded`);
  verify(source?.blockNumber === proof.sourceBlock, `${proof.action}: source block matches the Attestcoin request`);
  verify(
    source !== null && sameAddress(source.to ?? "0x0000000000000000000000000000000000000000", proofs.sourceLoanBook),
    `${proof.action}: source transaction targets SourceLoanBook`
  );
  verify(acceptance !== null && acceptance.status === 1, `${proof.action}: Creditcoin Attestcoin acceptance succeeded`);
  verify(
    acceptance !== null && sameAddress(acceptance.to ?? "0x0000000000000000000000000000000000000000", proofs.evidenceRegistry),
    `${proof.action}: acceptance targets ProofReserveEvidence`
  );
  verify(processed, `${proof.action}: query ID is marked processed on Creditcoin`);
}

const epoch = proofs.checkpointEpoch;
const [checkpointRoot, settledCount, settledValue, lateCount, lateValue, lossCount, lossValue] = await Promise.all([
  evidence.getFunction("checkpointRoots").staticCall(epoch),
  evidence.getFunction("settledCount").staticCall(epoch),
  evidence.getFunction("settledValue").staticCall(epoch),
  evidence.getFunction("lateCount").staticCall(epoch),
  evidence.getFunction("lateValue").staticCall(epoch),
  evidence.getFunction("lossCount").staticCall(epoch),
  evidence.getFunction("lossValue").staticCall(epoch)
]);
verify(String(checkpointRoot).toLowerCase() === proofs.checkpointRoot.toLowerCase(), "on-chain checkpoint root matches the public epoch-2 manifest");
verify(Number(settledCount) === 4 && Number(lateCount) === 2 && Number(lossCount) === 0, "on-chain evidence totals are 4 settled, 2 late, 0 loss");
verify(settledValue === 40n * 10n ** 18n && lateValue === 500n * 10n ** 18n && lossValue === 0n, "on-chain payment values are 40 settled versus 500 late");

validateRiskAssessment(risk.features, risk.assessment);
verify(risk.features.evidenceRoot.toLowerCase() === String(checkpointRoot).toLowerCase(), "reviewed feature set is bound to the Attestcoin checkpoint");
const baseline = deterministicBaseline(risk.features);
verify(baseline.regime === "WATCH", "disclosed deterministic baseline returns WATCH / 20% reserve");
verify(risk.assessment.inferenceMode === "GEMINI", "saved assessment records Gemini inference mode");
verify(risk.assessment.regime === "STRESS" && risk.assessment.reserveBps === 4_000, "Gemini assessment raises protection to STRESS / 40%");
verify(risk.assessment.confidenceBps === 8_200, "Gemini assessment records 82% confidence");
verify(submission.assessment.decisionHash === risk.assessment.decisionHash, "submitted assessment matches the reviewed AI artifact");

const [activeRegime, activeReserveBps, activeEpoch, activeRoot, decisionUsed, enforcementReceipt] = await Promise.all([
  controller.getFunction("activeRegime").staticCall(),
  controller.getFunction("activeReserveBps").staticCall(),
  controller.getFunction("activeEpoch").staticCall(),
  controller.getFunction("activeEvidenceRoot").staticCall(),
  controller.getFunction("usedDecisions").staticCall(risk.assessment.decisionHash),
  cc3Provider.getTransactionReceipt(submission.submission.transactionHash)
]);
verify(Number(activeRegime) === 2 && Number(activeReserveBps) === 4_000, "Creditcoin controller currently enforces STRESS / 40%");
verify(Number(activeEpoch) === epoch && String(activeRoot).toLowerCase() === proofs.checkpointRoot.toLowerCase(), "controller is bound to epoch 2 and its evidence root");
verify(Boolean(decisionUsed), "decision hash is marked used and cannot be replayed");
verify(enforcementReceipt !== null && enforcementReceipt.status === 1 && enforcementReceipt.blockNumber === submission.submission.blockNumber, "reserve enforcement transaction succeeded at the recorded block");

const [owner, managedAssets, totalCommitments, lockedReserve, lendable, normalReserve, normalLendable] = await Promise.all([
  pool.getFunction("owner").staticCall(),
  pool.getFunction("totalManagedAssets").staticCall(),
  pool.getFunction("totalCommitments").staticCall(),
  pool.getFunction("lockedReserve").staticCall(),
  pool.getFunction("lendable").staticCall(),
  controller.getFunction("activeReserveBps").staticCall({blockTag: NORMAL_REFERENCE_BLOCK}),
  pool.getFunction("lendable").staticCall({blockTag: NORMAL_REFERENCE_BLOCK})
]);
verify(managedAssets === 100n * 10n ** 18n && totalCommitments === 0n, "live pool holds 100 managed assets with no staged commitments");
verify(lockedReserve === 40n * 10n ** 18n && lendable === 60n * 10n ** 18n, "live pool exposes 40 protected and 60 lendable");
verify(Number(normalReserve) === 1_000 && normalLendable === 90n * 10n ** 18n, "recorded NORMAL state exposes 10 protected and 90 lendable");

const request = parseUnits("70", 18);
const [normalAllowed, currentAllowed] = await Promise.all([
  contractAllows(pool, String(owner), request, NORMAL_REFERENCE_BLOCK),
  contractAllows(pool, String(owner), request)
]);
verify(normalAllowed, "70 prUSD was allowed by the contract in the recorded NORMAL state");
verify(!currentAllowed, "70 prUSD is blocked by the live STRESS-state contract");

console.log("\nProofReserve live verification PASSED");
console.log(`Checks: ${checks.length}`);
console.log(`Evidence: ${proofs.proofs.length} Attestcoin acceptances for epoch ${epoch}`);
console.log(`Decision: ${baseline.regime} baseline → ${risk.assessment.regime} Gemini → ${Number(activeReserveBps) / 100}% on Creditcoin`);
console.log(`Pool: ${formatUnits(managedAssets, 18)} managed / ${formatUnits(lockedReserve, 18)} protected / ${formatUnits(lendable, 18)} lendable`);
