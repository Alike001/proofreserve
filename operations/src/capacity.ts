import {
  Contract,
  JsonRpcProvider,
  VoidSigner,
  formatUnits,
  getAddress,
  isError,
  parseUnits
} from "ethers";

import {environmentInteger, required, writeManifest} from "../../deployment/src/common.js";
import {configuredBorrowers, readContract} from "./common.js";

const POOL_ABI = [
  "error InsufficientLendable(uint256 available,uint256 requested)",
  "function owner() view returns (address)",
  "function reserveController() view returns (address)",
  "function liquidAssets() view returns (uint256)",
  "function totalManagedAssets() view returns (uint256)",
  "function totalCommitments() view returns (uint256)",
  "function totalPrincipalOutstanding() view returns (uint256)",
  "function lockedReserve() view returns (uint256)",
  "function lendable() view returns (uint256)",
  "function commitLoan(address borrower,uint256 amount)"
];
const CONTROLLER_ABI = [
  "function activeRegime() view returns (uint8)",
  "function activeReserveBps() view returns (uint16)",
  "function activeEpoch() view returns (uint64)",
  "function activeEvidenceRoot() view returns (bytes32)"
];
const REGIMES = ["NORMAL", "WATCH", "STRESS", "CRISIS"] as const;

const label = process.argv[2]?.trim() || "current";
if (!/^[a-z0-9][a-z0-9-]*$/i.test(label)) {
  throw new Error("capacity-check label must contain only letters, numbers, and hyphens");
}

const rpcUrl = required("CREDITCOIN_RPC_URL");
const expectedChainId = environmentInteger("CREDITCOIN_CHAIN_ID", 102_031);
const provider = new JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();
const chainId = Number(network.chainId);
if (chainId !== expectedChainId) {
  throw new Error(`wrong chain for CREDITCOIN_RPC_URL: expected ${expectedChainId}, received ${chainId}`);
}

const poolAddress = getAddress(required("POOL_ADDRESS"));
const configuredControllerAddress = getAddress(required("RESERVE_CONTROLLER_ADDRESS"));
if ((await provider.getCode(poolAddress)) === "0x") {
  throw new Error(`no contract bytecode at POOL_ADDRESS ${poolAddress}`);
}
if ((await provider.getCode(configuredControllerAddress)) === "0x") {
  throw new Error(`no contract bytecode at RESERVE_CONTROLLER_ADDRESS ${configuredControllerAddress}`);
}

const pool = new Contract(poolAddress, POOL_ABI, provider);
const poolControllerAddress = getAddress((await readContract(pool, "reserveController")) as string);
if (poolControllerAddress !== configuredControllerAddress) {
  throw new Error(
    `pool controller ${poolControllerAddress} does not match RESERVE_CONTROLLER_ADDRESS ${configuredControllerAddress}`
  );
}

const controller = new Contract(configuredControllerAddress, CONTROLLER_ABI, provider);
const borrower = getAddress(configuredBorrowers()[0] ?? "");
const requestAmount = parseUnits(process.env.DEMO_LOAN_REQUEST_TOKENS?.trim() || "70", 18);
const blockNumber = await provider.getBlockNumber();
const [
  owner,
  liquidAssets,
  managedAssets,
  totalCommitments,
  principalOutstanding,
  lockedReserve,
  lendable,
  activeRegime,
  activeReserveBps,
  activeEpoch,
  activeEvidenceRoot
] = (await Promise.all([
  readContract(pool, "owner"),
  readContract(pool, "liquidAssets"),
  readContract(pool, "totalManagedAssets"),
  readContract(pool, "totalCommitments"),
  readContract(pool, "totalPrincipalOutstanding"),
  readContract(pool, "lockedReserve"),
  readContract(pool, "lendable"),
  readContract(controller, "activeRegime"),
  readContract(controller, "activeReserveBps"),
  readContract(controller, "activeEpoch"),
  readContract(controller, "activeEvidenceRoot")
])) as [string, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, string];

const regimeIndex = Number(activeRegime);
const regime = REGIMES[regimeIndex];
if (!regime) throw new Error(`controller returned unsupported regime ${regimeIndex}`);

let allowedByContract = false;
let rejection: {name: string; availableBaseUnits: string; requestedBaseUnits: string} | null = null;
const poolAsOwner = pool.connect(new VoidSigner(getAddress(owner), provider));
try {
  await poolAsOwner.getFunction("commitLoan").staticCall(borrower, requestAmount);
  allowedByContract = true;
} catch (error) {
  if (!isError(error, "CALL_EXCEPTION")) throw error;
  const parsed = error.revert ?? (error.data ? pool.interface.parseError(error.data) : null);
  if (parsed?.name !== "InsufficientLendable") {
    throw new Error(`capacity simulation reverted unexpectedly: ${error.shortMessage}`, {cause: error});
  }
  rejection = {
    name: parsed.name,
    availableBaseUnits: (parsed.args[0] as bigint).toString(),
    requestedBaseUnits: (parsed.args[1] as bigint).toString()
  };
}

const expectedAllowed = requestAmount <= lendable;
if (allowedByContract !== expectedAllowed) {
  throw new Error(
    `contract simulation (${allowedByContract ? "allowed" : "blocked"}) disagrees with lendable state (${lendable.toString()})`
  );
}

const units = (value: bigint): string => formatUnits(value, 18);
const result = {
  schemaVersion: 1,
  label,
  chainId,
  blockNumber,
  pool: poolAddress,
  reserveController: configuredControllerAddress,
  borrower,
  regime,
  reserveBps: Number(activeReserveBps),
  activeEpoch: Number(activeEpoch),
  activeEvidenceRoot,
  financialState: {
    liquidAssets: units(liquidAssets),
    managedAssets: units(managedAssets),
    totalCommitments: units(totalCommitments),
    principalOutstanding: units(principalOutstanding),
    lockedReserve: units(lockedReserve),
    lendable: units(lendable)
  },
  request: {
    amount: units(requestAmount),
    allowedByContract,
    outcome: allowedByContract ? "ALLOWED" : "BLOCKED",
    rejection
  }
};

const manifestPath = `deployments/capacity-${label}.json`;
await writeManifest(manifestPath, result);
console.log(JSON.stringify({...result, manifestPath}, null, 2));
