import {Contract, getAddress, id, parseUnits} from "ethers";

import {
  deploymentContext,
  environmentInteger,
  required,
  writeManifest
} from "../../deployment/src/common.js";
import {
  configuredBorrowers,
  readContract,
  sendContractTransaction,
  type TransactionRecord
} from "./common.js";

const SOURCE_ABI = [
  "function currentEpoch() view returns (uint64)",
  "function factsInCurrentEpoch() view returns (uint64)",
  "function checkpointRoots(uint64 epoch) view returns (bytes32)",
  "function obligations(bytes32 obligationId) view returns (address borrower,uint128 principal,uint64 dueAt,uint8 status)",
  "function openObligation(bytes32 obligationId,address borrower,uint128 principal,uint64 dueAt)",
  "function reportPaymentSettled(bytes32 obligationId,uint128 amount,uint64 paidAt)",
  "function reportPaymentLate(bytes32 obligationId,uint128 amount,uint64 observedAt)",
  "function closeCheckpoint(uint64 epoch) returns (bytes32 factsRoot)"
];

const epoch = 1n;
const confirmations = environmentInteger("SOURCE_CONFIRMATIONS", 1);
if (confirmations === 0) throw new Error("SOURCE_CONFIRMATIONS must be positive");

const context = await deploymentContext(
  "SOURCE_CHAIN_RPC_URL",
  "SOURCE_DEPLOYER_PRIVATE_KEY",
  environmentInteger("SOURCE_CHAIN_ID", 11_155_111)
);
const source = new Contract(
  getAddress(required("SOURCE_LOAN_BOOK_ADDRESS")),
  SOURCE_ABI,
  context.signer
);
const borrowers = configuredBorrowers().map(getAddress);
if (borrowers.length !== 3 || new Set(borrowers).size !== 3) {
  throw new Error("DEMO_BORROWER_ADDRESSES must contain exactly three unique addresses");
}

const currentEpoch = (await readContract(source, "currentEpoch")) as bigint;
const existingFacts = (await readContract(source, "factsInCurrentEpoch")) as bigint;
if (currentEpoch !== epoch || existingFacts !== 0n) {
  throw new Error(
    `stress scenario requires a clean epoch 1; current epoch=${currentEpoch.toString()}, facts=${existingFacts.toString()}`
  );
}

const obligationAmount = parseUnits(process.env.DEMO_OBLIGATION_TOKENS?.trim() || "100", 18);
if (obligationAmount > (1n << 128n) - 1n) throw new Error("DEMO_OBLIGATION_TOKENS exceeds uint128");

const latestBlock = await context.provider.getBlock("latest");
if (!latestBlock) throw new Error("cannot read the latest source block");
const dueAt = BigInt(latestBlock.timestamp + 3_600);
const settledAt = dueAt - 1_800n;
const lateObservedAt = dueAt + 3_600n;

const scenarios = [
  {label: "settled-1", borrower: borrowers[0], outcome: "settled"},
  {label: "settled-2", borrower: borrowers[1], outcome: "settled"},
  {label: "settled-3", borrower: borrowers[2], outcome: "settled"},
  {label: "settled-4", borrower: borrowers[2], outcome: "settled"},
  {label: "late-1", borrower: borrowers[0], outcome: "late"},
  {label: "late-2", borrower: borrowers[1], outcome: "late"}
] as const;

const transactions: TransactionRecord[] = [];
const factTransactions: TransactionRecord[] = [];

for (const scenario of scenarios) {
  if (!scenario.borrower) throw new Error(`missing borrower for ${scenario.label}`);
  const obligationId = id(`proofreserve-demo-epoch-1-${scenario.label}`);
  const obligation = (await readContract(source, "obligations", [obligationId])) as [
    string,
    bigint,
    bigint,
    bigint
  ];
  if (obligation[3] !== 0n) {
    throw new Error(`obligation ${scenario.label} already exists; use a fresh source deployment`);
  }

  transactions.push(
    await sendContractTransaction(
      source,
      "openObligation",
      [obligationId, scenario.borrower, obligationAmount, dueAt],
      confirmations,
      `open ${scenario.label}`
    )
  );

  const factTransaction = await sendContractTransaction(
    source,
    scenario.outcome === "settled" ? "reportPaymentSettled" : "reportPaymentLate",
    [obligationId, obligationAmount, scenario.outcome === "settled" ? settledAt : lateObservedAt],
    confirmations,
    `report ${scenario.label}`
  );
  transactions.push(factTransaction);
  factTransactions.push(factTransaction);
}

const checkpointTransaction = await sendContractTransaction(
  source,
  "closeCheckpoint",
  [epoch],
  confirmations,
  "close epoch 1 checkpoint"
);
transactions.push(checkpointTransaction);
factTransactions.push(checkpointTransaction);

const factsRoot = (await readContract(source, "checkpointRoots", [epoch])) as string;
const manifestPath = process.env.SCENARIO_MANIFEST?.trim() || "deployments/scenario-epoch-1.json";
await writeManifest(manifestPath, {
  schemaVersion: 1,
  sourceChainId: context.chainId,
  sourceLoanBook: await source.getAddress(),
  epoch: Number(epoch),
  factsRoot,
  factCount: scenarios.length,
  settledFactCount: scenarios.filter(({outcome}) => outcome === "settled").length,
  lateFactCount: scenarios.filter(({outcome}) => outcome === "late").length,
  obligationAmountBaseUnits: obligationAmount.toString(),
  dueAt: dueAt.toString(),
  transactions,
  attestcoinSourceTransactionHashes: factTransactions.map(({transactionHash}) => transactionHash)
});

console.log(
  JSON.stringify(
    {
      manifestPath,
      epoch: Number(epoch),
      factsRoot,
      attestcoinSourceTransactionHashes: factTransactions.map(({transactionHash}) => transactionHash)
    },
    null,
    2
  )
);
