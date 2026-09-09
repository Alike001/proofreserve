export interface WorkerConfig {
  sourceChainKey: number;
  sourceRpcUrl: string;
  creditcoinRpcUrl: string;
  proofBuilderUrl: string;
  sourceLoanBookAddress: string;
  evidenceRegistryAddress: string;
  workerPrivateKey: string;
  sourceConfirmations: number;
  statePath: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(name: string, fallback?: number): number {
  const raw = process.env[name]?.trim();
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig(): WorkerConfig {
  return {
    sourceChainKey: positiveInteger("SOURCE_CHAIN_KEY"),
    sourceRpcUrl: required("SOURCE_CHAIN_RPC_URL"),
    creditcoinRpcUrl: required("CREDITCOIN_RPC_URL"),
    proofBuilderUrl: required("PROOF_BUILDER_URL"),
    sourceLoanBookAddress: required("SOURCE_LOAN_BOOK_ADDRESS"),
    evidenceRegistryAddress: required("EVIDENCE_REGISTRY_ADDRESS"),
    workerPrivateKey: required("CREDITCOIN_WORKER_PRIVATE_KEY"),
    sourceConfirmations: positiveInteger("SOURCE_CONFIRMATIONS", 1),
    statePath: process.env.WORKER_STATE_PATH?.trim() || ".proofreserve/worker-state.json"
  };
}
