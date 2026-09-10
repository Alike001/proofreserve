import {Contract, EventLog, JsonRpcProvider, VoidSigner, formatUnits, parseUnits} from "ethers";

const EVIDENCE_ABI = [
  "function currentEpoch() view returns (uint64)",
  "function checkpointRoots(uint64 epoch) view returns (bytes32)",
  "function settledCount(uint64 epoch) view returns (uint64)",
  "function lateCount(uint64 epoch) view returns (uint64)",
  "function lossCount(uint64 epoch) view returns (uint64)"
];
const CONTROLLER_ABI = [
  "function activeRegime() view returns (uint8)",
  "function activeReserveBps() view returns (uint16)",
  "function activeEpoch() view returns (uint64)",
  "function activeEvidenceRoot() view returns (bytes32)",
  "event ReserveIncreased(bytes32 indexed decisionHash,uint8 indexed regime,uint16 reserveBps,uint64 indexed epoch,bytes32 evidenceRoot)"
];
const POOL_ABI = [
  "function owner() view returns (address)",
  "function totalManagedAssets() view returns (uint256)",
  "function lendable() view returns (uint256)",
  "function commitLoan(address borrower,uint256 amount)",
  "error InsufficientLendable(uint256 available,uint256 requested)"
];

const CANONICAL_NORMAL_BLOCK = 5_460_299;
const CAPACITY_TEST_BORROWER = "0x000000000000000000000000000000000000B001";

export type DataMode = "preview" | "live";

export interface AuditRecord {
  id: number;
  event: string;
  detail: string;
  chain: string;
  hash: string;
  time: string;
  tone: "safe" | "risk" | "neutral";
  category: "EVIDENCE" | "ASSESSMENT" | "ENFORCEMENT" | "SYSTEM";
}

export interface DashboardSnapshot {
  mode: DataMode;
  epoch: number;
  factCount: number;
  settledCount: number;
  lateCount: number;
  lossCount: number;
  previousReservePercent: number;
  reservePercent: number;
  previousLendable: number;
  lendable: number;
  blockedRequest: number;
  regime: "NORMAL" | "WATCH" | "STRESS" | "CRISIS";
  confidencePercent: number;
  reason: string;
  evidenceRoot: string;
  decisionHash: string;
  reserveTransactionHash: string;
  records: AuditRecord[];
}

export interface CapacityState {
  blockNumber: number;
  reservePercent: number;
  lendable: number;
  outcome: "ALLOWED" | "BLOCKED";
  reason: string;
}

export interface CapacityComparison {
  amount: number;
  normal: CapacityState;
  current: CapacityState;
}

export const previewSnapshot: DashboardSnapshot = {
  mode: "preview",
  epoch: 1,
  factCount: 6,
  settledCount: 4,
  lateCount: 2,
  lossCount: 0,
  previousReservePercent: 10,
  reservePercent: 40,
  previousLendable: 90,
  lendable: 60,
  blockedRequest: 70,
  regime: "STRESS",
  confidencePercent: 85,
  reason: "Correlated lateness detected across one borrower group.",
  evidenceRoot: "0xb2fd86784e6e309e4484909b67526a11657e841cdcff8fb38255dfb9c2519750",
  decisionHash: "0x9f27d08b643c592b61c89f2fea4c72ffbf740194a5561778b626de2ea79c14b6",
  reserveTransactionHash: "",
  records: buildRecords(
    "0xb2fd86784e6e309e4484909b67526a11657e841cdcff8fb38255dfb9c2519750",
    "0x9f27d08b643c592b61c89f2fea4c72ffbf740194a5561778b626de2ea79c14b6",
    "",
    1,
    6,
    4,
    2,
    40,
    "STRESS"
  )
};

function requiredPublicConfig(): {
  rpcUrl: string;
  evidenceAddress: string;
  controllerAddress: string;
  poolAddress: string;
} | null {
  const rpcUrl = import.meta.env.VITE_CREDITCOIN_RPC_URL?.trim();
  const evidenceAddress = import.meta.env.VITE_EVIDENCE_REGISTRY_ADDRESS?.trim();
  const controllerAddress = import.meta.env.VITE_RESERVE_CONTROLLER_ADDRESS?.trim();
  const poolAddress = import.meta.env.VITE_POOL_ADDRESS?.trim();
  if (!rpcUrl || !evidenceAddress || !controllerAddress || !poolAddress) return null;
  return {rpcUrl, evidenceAddress, controllerAddress, poolAddress};
}

export function hasLiveConfiguration(): boolean {
  return requiredPublicConfig() !== null;
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const config = requiredPublicConfig();
  if (!config) return structuredClone(previewSnapshot);

  const provider = new JsonRpcProvider(config.rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 102_031) {
    throw new Error(`Expected Creditcoin CC3 chain 102031, received ${network.chainId.toString()}`);
  }

  const evidence = new Contract(config.evidenceAddress, EVIDENCE_ABI, provider);
  const controller = new Contract(config.controllerAddress, CONTROLLER_ABI, provider);
  const pool = new Contract(config.poolAddress, POOL_ABI, provider);
  const activeEpoch = Number(await controller.getFunction("activeEpoch").staticCall());
  const evidenceCurrentEpoch = Number(await evidence.getFunction("currentEpoch").staticCall());
  const epoch = activeEpoch > 0 ? activeEpoch : Math.max(1, evidenceCurrentEpoch - 1);

  const [settled, late, loss, evidenceRoot, regimeIndex, reserveBps, managedAssets, lendable] =
    await Promise.all([
      evidence.getFunction("settledCount").staticCall(epoch),
      evidence.getFunction("lateCount").staticCall(epoch),
      evidence.getFunction("lossCount").staticCall(epoch),
      evidence.getFunction("checkpointRoots").staticCall(epoch),
      controller.getFunction("activeRegime").staticCall(),
      controller.getFunction("activeReserveBps").staticCall(),
      pool.getFunction("totalManagedAssets").staticCall(),
      pool.getFunction("lendable").staticCall()
    ]);

  const latestBlock = await provider.getBlockNumber();
  const configuredStart = Number(import.meta.env.VITE_CONTROLLER_DEPLOYMENT_BLOCK || 0);
  const fromBlock = Math.max(configuredStart, latestBlock - 50_000);
  const reserveEvents = await controller.queryFilter("ReserveIncreased", fromBlock, latestBlock);
  const latestReserveEvent = reserveEvents.at(-1);
  const parsedEvent = latestReserveEvent instanceof EventLog ? latestReserveEvent : null;
  const decisionHash = parsedEvent ? String(parsedEvent.args[0]) : zeroHash();
  const reserveTransactionHash = parsedEvent?.transactionHash || "";
  const regime = (["NORMAL", "WATCH", "STRESS", "CRISIS"] as const)[Number(regimeIndex)] || "NORMAL";
  const reservePercent = Number(reserveBps) / 100;
  const factCount = Number(settled) + Number(late) + Number(loss);
  const managed = Number(formatUnits(managedAssets, 18));
  const currentLendable = Number(formatUnits(lendable, 18));
  const confidencePercent = Number(import.meta.env.VITE_LAST_CONFIDENCE_BPS || 8500) / 100;

  return {
    mode: "live",
    epoch,
    factCount,
    settledCount: Number(settled),
    lateCount: Number(late),
    lossCount: Number(loss),
    previousReservePercent: 10,
    reservePercent,
    previousLendable: managed * 0.9,
    lendable: currentLendable,
    blockedRequest: 70,
    regime,
    confidencePercent,
    reason: regime === "STRESS" ? "Correlated lateness detected across one borrower group." : "Policy checks reflect the latest verified evidence.",
    evidenceRoot: String(evidenceRoot),
    decisionHash,
    reserveTransactionHash,
    records: buildRecords(
      String(evidenceRoot),
      decisionHash,
      reserveTransactionHash,
      epoch,
      factCount,
      Number(settled),
      Number(late),
      reservePercent,
      regime
    )
  };
}

export async function simulateLoanCapacity(amount: number): Promise<CapacityComparison> {
  if (!Number.isFinite(amount) || amount < 0.000001 || amount > 1_000_000) {
    throw new Error("Enter a loan amount between 0.000001 and 1,000,000 prUSD.");
  }

  const config = requiredPublicConfig();
  if (!config) throw new Error("Live Creditcoin configuration is unavailable.");

  const provider = new JsonRpcProvider(config.rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 102_031) {
    throw new Error(`Expected Creditcoin CC3 chain 102031, received ${network.chainId.toString()}`);
  }

  const pool = new Contract(config.poolAddress, POOL_ABI, provider);
  const controller = new Contract(config.controllerAddress, CONTROLLER_ABI, provider);
  const [owner, currentBlock] = await Promise.all([
    pool.getFunction("owner").staticCall(),
    provider.getBlockNumber()
  ]);
  const normalBlock = Number(import.meta.env.VITE_NORMAL_STATE_BLOCK || CANONICAL_NORMAL_BLOCK);
  if (!Number.isSafeInteger(normalBlock) || normalBlock <= 0 || normalBlock > currentBlock) {
    throw new Error("The configured NORMAL reference block is invalid.");
  }

  const caller = new VoidSigner(String(owner), provider);
  const poolAsOwner = pool.connect(caller) as Contract;
  const requested = parseUnits(amount.toFixed(6), 18);

  const testState = async (blockNumber: number): Promise<CapacityState> => {
    const [reserveBps, available] = await Promise.all([
      controller.getFunction("activeReserveBps").staticCall({blockTag: blockNumber}),
      pool.getFunction("lendable").staticCall({blockTag: blockNumber})
    ]);

    try {
      await poolAsOwner.getFunction("commitLoan").staticCall(
        CAPACITY_TEST_BORROWER,
        requested,
        {blockTag: blockNumber}
      );
      return {
        blockNumber,
        reservePercent: Number(reserveBps) / 100,
        lendable: Number(formatUnits(available, 18)),
        outcome: "ALLOWED",
        reason: "The request fits inside the contract's lendable capacity."
      };
    } catch (error) {
      const revertName = readRevertName(error);
      if (revertName !== "InsufficientLendable") throw error;
      return {
        blockNumber,
        reservePercent: Number(reserveBps) / 100,
        lendable: Number(formatUnits(available, 18)),
        outcome: "BLOCKED",
        reason: "The request exceeds the capacity left after the protected reserve."
      };
    }
  };

  const [normal, current] = await Promise.all([testState(normalBlock), testState(currentBlock)]);
  return {amount, normal, current};
}

function readRevertName(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const candidate = error as {revert?: {name?: unknown}; info?: {error?: {data?: {name?: unknown}}}};
  if (typeof candidate.revert?.name === "string") return candidate.revert.name;
  if (typeof candidate.info?.error?.data?.name === "string") return candidate.info.error.data.name;
  return "";
}

function buildRecords(
  evidenceRoot: string,
  decisionHash: string,
  reserveTransactionHash: string,
  epoch: number,
  factCount: number,
  settled: number,
  late: number,
  reservePercent: number,
  regime: string
): AuditRecord[] {
  return [
    {id: 1, event: "Verified source facts", detail: `${factCount} repayment facts (${settled} settled, ${late} late)`, chain: "Sepolia / Attestcoin", hash: evidenceRoot, time: "Evidence accepted", tone: "safe", category: "EVIDENCE"},
    {id: 2, event: `Checkpoint epoch ${epoch}`, detail: "Portfolio facts committed by root", chain: "CC3 Testnet", hash: evidenceRoot, time: `Epoch ${epoch} finalized`, tone: "safe", category: "EVIDENCE"},
    {id: 3, event: "AI decision digest", detail: `${regime} · policy-bounded`, chain: "Gemini / off-chain", hash: decisionHash, time: "Assessment verified", tone: "risk", category: "ASSESSMENT"},
    {id: 4, event: "Reserve update", detail: `Reserve enforced at ${formatNumber(reservePercent)}%`, chain: "CC3 Testnet", hash: reserveTransactionHash || decisionHash, time: "Contract enforced", tone: "safe", category: "ENFORCEMENT"}
  ];
}

export function shortHash(value: string): string {
  return value && value !== zeroHash() ? `${value.slice(0, 8)}…${value.slice(-6)}` : "Pending";
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function zeroHash(): string {
  return `0x${"00".repeat(32)}`;
}
