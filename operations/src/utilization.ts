import {readFile} from "node:fs/promises";

import {Contract, getAddress, parseUnits} from "ethers";

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

const POOL_ABI = [
  "function totalManagedAssets() view returns (uint256)",
  "function totalCommitments() view returns (uint256)",
  "function lendable() view returns (uint256)",
  "function commitments(address borrower) view returns (uint256)",
  "function commitLoan(address borrower,uint256 amount)",
  "function cancelCommitment(address borrower,uint256 amount)"
];

interface UtilizationManifest {
  transactions?: TransactionRecord[];
}

const [command] = process.argv.slice(2);
if (command !== "stage" && command !== "clear") {
  throw new Error("usage: pnpm utilization:stage | pnpm utilization:clear");
}

const context = await deploymentContext(
  "CREDITCOIN_RPC_URL",
  "CREDITCOIN_DEPLOYER_PRIVATE_KEY",
  environmentInteger("CREDITCOIN_CHAIN_ID", 102_031)
);
const pool = new Contract(getAddress(required("POOL_ADDRESS")), POOL_ABI, context.signer);
const borrower = getAddress(configuredBorrowers()[0]!);
const requestedAmount = parseUnits(process.env.AI_UTILIZATION_TOKENS?.trim() || "60", 18);
const confirmations = environmentInteger("CREDITCOIN_CONFIRMATIONS", 1);
if (requestedAmount === 0n || confirmations === 0) {
  throw new Error("AI utilization amount and confirmation count must be positive");
}

const beforeCommitment = (await readContract(pool, "commitments", [borrower])) as bigint;
const beforeTotalCommitments = (await readContract(pool, "totalCommitments")) as bigint;
const transactions: TransactionRecord[] = [];

if (command === "stage") {
  if (beforeCommitment !== 0n || beforeTotalCommitments !== 0n) {
    throw new Error("AI utilization staging requires a pool with no existing commitments");
  }
  transactions.push(
    await sendContractTransaction(
      pool,
      "commitLoan",
      [borrower, requestedAmount],
      confirmations,
      "stage temporary AI utilization"
    )
  );
} else {
  if (beforeCommitment === 0n) throw new Error("no staged AI utilization commitment exists");
  transactions.push(
    await sendContractTransaction(
      pool,
      "cancelCommitment",
      [borrower, beforeCommitment],
      confirmations,
      "clear temporary AI utilization"
    )
  );
}

const [managedAssets, totalCommitments, lendable, borrowerCommitment] = await Promise.all([
  readContract(pool, "totalManagedAssets"),
  readContract(pool, "totalCommitments"),
  readContract(pool, "lendable"),
  readContract(pool, "commitments", [borrower])
]) as [bigint, bigint, bigint, bigint];

const manifestPath = process.env.AI_UTILIZATION_MANIFEST?.trim() || "deployments/ai-utilization.json";
let previousTransactions: TransactionRecord[] = [];
try {
  const previous = JSON.parse(await readFile(manifestPath, "utf8")) as UtilizationManifest;
  if (Array.isArray(previous.transactions)) previousTransactions = previous.transactions;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

await writeManifest(manifestPath, {
  schemaVersion: 1,
  chainId: context.chainId,
  pool: await pool.getAddress(),
  borrower,
  state: command === "stage" ? "STAGED" : "CLEARED",
  managedAssetsBaseUnits: managedAssets.toString(),
  totalCommitmentsBaseUnits: totalCommitments.toString(),
  borrowerCommitmentBaseUnits: borrowerCommitment.toString(),
  lendableBaseUnits: lendable.toString(),
  transactions: [...previousTransactions, ...transactions]
});

console.log(
  JSON.stringify(
    {
      manifestPath,
      state: command === "stage" ? "STAGED" : "CLEARED",
      managedAssetsBaseUnits: managedAssets.toString(),
      totalCommitmentsBaseUnits: totalCommitments.toString(),
      lendableBaseUnits: lendable.toString(),
      transactions
    },
    null,
    2
  )
);
