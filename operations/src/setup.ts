import {readFile} from "node:fs/promises";

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
  "function borrowers(address borrower) view returns (bytes32 groupId,bool registered)",
  "function registerBorrower(address borrower,bytes32 groupId)"
];
const EVIDENCE_ABI = [
  "function borrowerGroups(address borrower) view returns (bytes32)",
  "function registerBorrower(address borrower,bytes32 groupId)"
];
const ASSET_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function mint(address to,uint256 amount)",
  "function approve(address spender,uint256 amount) returns (bool)"
];
const POOL_ABI = [
  "function totalManagedAssets() view returns (uint256)",
  "function deposit(uint256 amount)"
];

interface ExistingSetupManifest {
  sourceLoanBook?: unknown;
  evidenceRegistry?: unknown;
  pool?: unknown;
  testAsset?: unknown;
  poolSeedBaseUnits?: unknown;
  transactions?: unknown;
}

async function existingTransactions(
  manifestPath: string,
  identity: {
    sourceLoanBook: string;
    evidenceRegistry: string;
    pool: string;
    testAsset: string;
    poolSeedBaseUnits: string;
  }
): Promise<TransactionRecord[]> {
  let existing: ExistingSetupManifest;
  try {
    existing = JSON.parse(await readFile(manifestPath, "utf8")) as ExistingSetupManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`cannot read existing setup manifest ${manifestPath}`, {cause: error});
  }

  const sameAddress = (left: unknown, right: string): boolean =>
    typeof left === "string" && left.toLowerCase() === right.toLowerCase();
  if (
    !sameAddress(existing.sourceLoanBook, identity.sourceLoanBook) ||
    !sameAddress(existing.evidenceRegistry, identity.evidenceRegistry) ||
    !sameAddress(existing.pool, identity.pool) ||
    !sameAddress(existing.testAsset, identity.testAsset) ||
    existing.poolSeedBaseUnits !== identity.poolSeedBaseUnits
  ) {
    throw new Error(`existing setup manifest ${manifestPath} belongs to a different deployment`);
  }
  if (!Array.isArray(existing.transactions)) {
    throw new Error(`existing setup manifest ${manifestPath} has no transaction history`);
  }

  return existing.transactions as TransactionRecord[];
}

const borrowers = configuredBorrowers().map(getAddress);
if (borrowers.length !== 3 || new Set(borrowers).size !== 3) {
  throw new Error("DEMO_BORROWER_ADDRESSES must contain exactly three unique addresses");
}
const groupA = id(process.env.DEMO_GROUP_A_LABEL?.trim() || "proofreserve-group-a");
const groupB = id(process.env.DEMO_GROUP_B_LABEL?.trim() || "proofreserve-group-b");
const groups = [groupA, groupA, groupB];
const sourceConfirmations = environmentInteger("SOURCE_CONFIRMATIONS", 1);
const creditcoinConfirmations = environmentInteger("CREDITCOIN_CONFIRMATIONS", 1);
if (sourceConfirmations === 0 || creditcoinConfirmations === 0) {
  throw new Error("operation confirmation counts must be positive");
}

const sourceContext = await deploymentContext(
  "SOURCE_CHAIN_RPC_URL",
  "SOURCE_DEPLOYER_PRIVATE_KEY",
  environmentInteger("SOURCE_CHAIN_ID", 11_155_111)
);
const creditcoinContext = await deploymentContext(
  "CREDITCOIN_RPC_URL",
  "CREDITCOIN_DEPLOYER_PRIVATE_KEY",
  environmentInteger("CREDITCOIN_CHAIN_ID", 102_031)
);
const source = new Contract(getAddress(required("SOURCE_LOAN_BOOK_ADDRESS")), SOURCE_ABI, sourceContext.signer);
const evidence = new Contract(
  getAddress(required("EVIDENCE_REGISTRY_ADDRESS")),
  EVIDENCE_ABI,
  creditcoinContext.signer
);
const asset = new Contract(getAddress(required("TEST_ASSET_ADDRESS")), ASSET_ABI, creditcoinContext.signer);
const poolAddress = getAddress(required("POOL_ADDRESS"));
const pool = new Contract(poolAddress, POOL_ABI, creditcoinContext.signer);
const transactions: TransactionRecord[] = [];

for (const [index, borrower] of borrowers.entries()) {
  const expectedGroup = groups[index];
  if (!expectedGroup) throw new Error(`missing group for borrower ${borrower}`);

  const sourceBorrower = (await readContract(source, "borrowers", [borrower])) as [string, boolean];
  if (!sourceBorrower[1]) {
    transactions.push(
      await sendContractTransaction(
        source,
        "registerBorrower",
        [borrower, expectedGroup],
        sourceConfirmations,
        `register source borrower ${index + 1}`
      )
    );
  } else if (sourceBorrower[0] !== expectedGroup) {
    throw new Error(`source borrower ${borrower} belongs to an unexpected group`);
  }
}

// Finish all source-chain writes before destination-chain writes. Besides making
// the run easier to audit, this also supports one-node local smoke environments.
for (const [index, borrower] of borrowers.entries()) {
  const expectedGroup = groups[index];
  if (!expectedGroup) throw new Error(`missing group for borrower ${borrower}`);

  const evidenceGroup = (await readContract(evidence, "borrowerGroups", [borrower])) as string;
  if (evidenceGroup === `0x${"00".repeat(32)}`) {
    transactions.push(
      await sendContractTransaction(
        evidence,
        "registerBorrower",
        [borrower, expectedGroup],
        creditcoinConfirmations,
        `register evidence borrower ${index + 1}`
      )
    );
  } else if (evidenceGroup !== expectedGroup) {
    throw new Error(`evidence borrower ${borrower} belongs to an unexpected group`);
  }
}

const seedAmount = parseUnits(process.env.DEMO_POOL_SEED_TOKENS?.trim() || "100", 18);
const managedAssets = (await readContract(pool, "totalManagedAssets")) as bigint;
if (managedAssets === 0n) {
  const depositor = await creditcoinContext.signer.getAddress();
  const balance = (await readContract(asset, "balanceOf", [depositor])) as bigint;
  if (balance < seedAmount) {
    transactions.push(
      await sendContractTransaction(
        asset,
        "mint",
        [depositor, seedAmount - balance],
        creditcoinConfirmations,
        "mint pool seed assets"
      )
    );
  }

  const allowance = (await readContract(asset, "allowance", [depositor, poolAddress])) as bigint;
  if (allowance < seedAmount) {
    transactions.push(
      await sendContractTransaction(
        asset,
        "approve",
        [poolAddress, seedAmount],
        creditcoinConfirmations,
        "approve pool seed assets"
      )
    );
  }
  transactions.push(
    await sendContractTransaction(
      pool,
      "deposit",
      [seedAmount],
      creditcoinConfirmations,
      "deposit pool seed assets"
    )
  );
} else if (managedAssets !== seedAmount) {
  throw new Error(
    `pool already has ${managedAssets.toString()} managed base units; expected ${seedAmount.toString()}`
  );
}

const manifestPath = process.env.SETUP_MANIFEST?.trim() || "deployments/setup.json";
const sourceLoanBookAddress = await source.getAddress();
const evidenceRegistryAddress = await evidence.getAddress();
const identity = {
  sourceLoanBook: sourceLoanBookAddress,
  evidenceRegistry: evidenceRegistryAddress,
  pool: poolAddress,
  testAsset: await asset.getAddress(),
  poolSeedBaseUnits: seedAmount.toString()
};
const previousTransactions = await existingTransactions(manifestPath, identity);
const recordedTransactions = [...previousTransactions, ...transactions].filter(
  (transaction, index, all) =>
    all.findIndex(({transactionHash}) => transactionHash === transaction.transactionHash) === index
);
await writeManifest(manifestPath, {
  schemaVersion: 1,
  sourceChainId: sourceContext.chainId,
  creditcoinChainId: creditcoinContext.chainId,
  sourceLoanBook: sourceLoanBookAddress,
  evidenceRegistry: evidenceRegistryAddress,
  pool: poolAddress,
  testAsset: identity.testAsset,
  borrowers: borrowers.map((borrower, index) => ({borrower, groupId: groups[index]})),
  poolSeedBaseUnits: seedAmount.toString(),
  transactions: recordedTransactions
});

console.log(
  JSON.stringify(
    {
      manifestPath,
      borrowerCount: borrowers.length,
      transactions,
      recordedTransactionCount: recordedTransactions.length
    },
    null,
    2
  )
);
