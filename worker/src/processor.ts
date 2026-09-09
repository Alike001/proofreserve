import {proofProvider} from "@gluwa/usc-sdk";
import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  TransactionReceipt,
  Wallet,
  getAddress,
  id,
  keccak256
} from "ethers";

import {WorkerConfig} from "./config.js";
import {StateStore, WorkItem} from "./state.js";

const EVENT_ACTIONS = new Map<string, number>([
  [id("PaymentSettled(bytes32,bytes32,address,bytes32,uint128,uint64,uint64,uint64)"), 0],
  [id("PaymentLate(bytes32,bytes32,address,bytes32,uint128,uint64,uint64,uint64)"), 1],
  [id("LossRealized(bytes32,bytes32,address,bytes32,uint128,uint64,uint64)"), 2],
  [id("PortfolioCheckpoint(bytes32,uint64,bytes32,uint64,uint64)"), 3]
]);

const EVIDENCE_ABI = [
  "function execute(uint8 action,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,tuple(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) returns (bool)",
  "function processedQueries(bytes32 queryId) view returns (bool)"
];

export class FactProcessor {
  private readonly sourceProvider: JsonRpcProvider;
  private readonly creditcoinProvider: JsonRpcProvider;
  private readonly proofBuilder: proofProvider.service.ProofBuilder;
  private readonly evidence: Contract;

  constructor(
    private readonly config: WorkerConfig,
    private readonly store: StateStore
  ) {
    this.sourceProvider = new JsonRpcProvider(config.sourceRpcUrl);
    this.creditcoinProvider = new JsonRpcProvider(config.creditcoinRpcUrl);
    this.proofBuilder = new proofProvider.service.ProofBuilder(
      config.sourceChainKey,
      config.proofBuilderUrl,
      10_000
    );
    const signer = new Wallet(config.workerPrivateKey, this.creditcoinProvider);
    this.evidence = new Contract(config.evidenceRegistryAddress, EVIDENCE_ABI, signer);
  }

  async process(item: WorkItem): Promise<void> {
    try {
      const receipt = await this.waitForSuccessfulReceipt(item.sourceTxHash);
      const action = this.detectAction(receipt);
      await this.store.update(item.sourceTxHash, {
        status: "WAITING_ATTESTATION",
        action,
        sourceBlock: receipt.blockNumber,
        attempts: item.attempts + 1,
        error: undefined
      });

      await this.proofBuilder.waitUntilHeightAttested(
        this.config.sourceChainKey,
        receipt.blockNumber,
        15_000,
        1_200_000
      );
      const result = await this.proofBuilder.getProof(item.sourceTxHash);
      if (!result.success || !result.data) {
        throw new Error(result.error || "proof builder returned no proof data");
      }

      const proof = result.data;
      const queryId = keccak256(
        AbiCoder.defaultAbiCoder().encode(
          ["uint64", "uint64", "uint64"],
          [proof.chainKey, proof.headerNumber, proof.txIndex]
        )
      );
      await this.store.update(item.sourceTxHash, {status: "PROOF_READY", queryId});

      const processedQueries = this.evidence.getFunction("processedQueries");
      if (await processedQueries.staticCall(queryId)) {
        await this.store.update(item.sourceTxHash, {status: "FINALIZED", queryId});
        return;
      }

      const args = [
        action,
        proof.chainKey,
        proof.headerNumber,
        proof.txBytes,
        proof.merkleProof.root,
        proof.merkleProof.siblings,
        proof.continuityProof.lowerEndpointDigest,
        proof.continuityProof.roots
      ] as const;

      let gasLimit: bigint;
      const execute = this.evidence.getFunction("execute");
      try {
        const estimate = await execute.estimateGas(...args);
        gasLimit = (estimate * 135n) / 100n;
      } catch {
        gasLimit = 750_000n + BigInt(proof.continuityProof.roots.length) * 15_000n;
      }

      const response = await execute.send(...args, {gasLimit});
      await this.store.update(item.sourceTxHash, {
        status: "SUBMITTED",
        creditcoinTxHash: response.hash,
        queryId
      });
      const creditcoinReceipt = await response.wait();
      if (!creditcoinReceipt || creditcoinReceipt.status !== 1) {
        throw new Error("Creditcoin evidence transaction failed");
      }
      await this.store.update(item.sourceTxHash, {
        status: "FINALIZED",
        creditcoinTxHash: response.hash,
        queryId,
        error: undefined
      });
    } catch (error) {
      await this.store.update(item.sourceTxHash, {
        status: "FAILED",
        attempts: item.attempts + 1,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async waitForSuccessfulReceipt(sourceTxHash: string): Promise<TransactionReceipt> {
    const receipt = await this.sourceProvider.waitForTransaction(
      sourceTxHash,
      this.config.sourceConfirmations,
      120_000
    );
    if (!receipt) throw new Error(`source transaction was not mined: ${sourceTxHash}`);
    if (receipt.status !== 1) throw new Error(`source transaction reverted: ${sourceTxHash}`);
    return receipt;
  }

  private detectAction(receipt: TransactionReceipt): number {
    const expectedEmitter = getAddress(this.config.sourceLoanBookAddress);
    const matchingActions = receipt.logs
      .filter((log) => getAddress(log.address) === expectedEmitter)
      .map((log) => (log.topics[0] ? EVENT_ACTIONS.get(log.topics[0]) : undefined))
      .filter((action): action is number => action !== undefined);

    if (matchingActions.length !== 1) {
      throw new Error(`expected exactly one ProofReserve source event, found ${matchingActions.length}`);
    }
    return matchingActions[0]!;
  }
}
