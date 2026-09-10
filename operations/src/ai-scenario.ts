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

const epoch = BigInt(environmentInteger("AI_SCENARIO_EPOCH", 2));
if (epoch === 0n) throw new Error("AI_SCENARIO_EPOCH must be positive");
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
    `AI-sensitive scenario requires clean epoch ${epoch.toString()}; current epoch=${currentEpoch.toString()}, facts=${existingFacts.toString()}`
  );
}

const settledAmount = parseUnits(process.env.AI_SETTLED_TOKENS?.trim() || "10", 18);
const lateAmount = parseUnits(process.env.AI_LATE_TOKENS?.trim() || "250", 18);
const uint128Maximum = (1n << 128n) - 1n;
if (settledAmount > uint128Maximum || lateAmount > uint128Maximum) {
  throw new Error("AI scenario token amounts exceed uint128");
}

const latestBlock = await context.provider.getBlock("latest");
if (!latestBlock) throw new Error("cannot read the latest source block");
const dueAt = BigInt(latestBlock.timestamp + 3_600);
const settledAt = dueAt - 1_800n;
const lateObservedAt = dueAt + 3_600n;

const scenarios = [
  {label: "settled-1", borrower: borrowers[0], outcome: "settled", amount: settledAmount},
  {label: "settled-2", borrower: borrowers[1], outcome: "settled", amount: settledAmount},
  {label: "settled-3", borrower: borrowers[2], outcome: "settled", amount: settledAmount},
  {label: "settled-4", borrower: borrowers[2], outcome: "settled", amount: settledAmount},
  {label: "late-large-1", borrower: borrowers[0], outcome: "late", amount: lateAmount},
  {label: "late-large-2", borrower: borrowers[2], outcome: "late", amount: lateAmount}
] as const;

const transactions: TransactionRecord[] = [];
const factTransactions: TransactionRecord[] = [];

for (const scenario of scenarios) {
  if (!scenario.borrower) throw new Error(`missing borrower for ${scenario.label}`);
  const obligationId = id(`proofreserve-ai-epoch-${epoch.toString()}-${scenario.label}`);
  const obligation = (await readContract(source, "obligations", [obligationId])) as [
    string,
    bigint,
    bigint,
    bigint
  ];
  if (obligation[3] !== 0n) {
    throw new Error(`obligation ${scenario.label} already exists`);
  }

  transactions.push(
    await sendContractTransaction(
      source,
      "openObligation",
      [obligationId, scenario.borrower, scenario.amount, dueAt],
      confirmations,
      `open ${scenario.label}`
    )
  );

  const factTransaction = await sendContractTransaction(
    source,
    scenario.outcome === "settled" ? "reportPaymentSettled" : "reportPaymentLate",
    [obligationId, scenario.amount, scenario.outcome === "settled" ? settledAt : lateObservedAt],
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
  `close epoch ${epoch.toString()} checkpoint`
);
transactions.push(checkpointTransaction);
factTransactions.push(checkpointTransaction);

const factsRoot = (await readContract(source, "checkpointRoots", [epoch])) as string;
const manifestPath = process.env.AI_SCENARIO_MANIFEST?.trim()
  || `deployments/scenario-epoch-${epoch.toString()}-ai.json`;
await writeManifest(manifestPath, {
  schemaVersion: 1,
  scenario: "AI_SENSITIVE_VOLUME_STRESS",
  sourceChainId: context.chainId,
  sourceLoanBook: await source.getAddress(),
  epoch: Number(epoch),
  factsRoot,
  factCount: scenarios.length,
  settledFactCount: scenarios.filter(({outcome}) => outcome === "settled").length,
  lateFactCount: scenarios.filter(({outcome}) => outcome === "late").length,
  settledAmountPerFactBaseUnits: settledAmount.toString(),
  lateAmountPerFactBaseUnits: lateAmount.toString(),
  designIntent: "Count-only baseline WATCH; Gemini may raise to STRESS from late-value severity across separate groups.",
  transactions,
  attestcoinSourceTransactionHashes: factTransactions.map(({transactionHash}) => transactionHash)
});

console.log(
  JSON.stringify(
    {
      manifestPath,
      epoch: Number(epoch),
      factsRoot,
      factPattern: "4 small settlements + 2 large late payments across separate borrower groups",
      attestcoinSourceTransactionHashes: factTransactions.map(({transactionHash}) => transactionHash)
    },
    null,
    2
  )
);
