import {getAddress, isHexString} from "ethers";

export interface RiskAgentConfig {
  creditcoinRpcUrl: string;
  evidenceRegistryAddress: string;
  reserveControllerAddress: string;
  poolAddress: string;
  evidenceDeploymentBlock: number;
  confirmations: number;
  geminiApiKey: string;
  geminiModel: string;
  agentPrivateKey: string | undefined;
}

export function loadRiskAgentConfig(requireSigner: boolean): RiskAgentConfig {
  const agentPrivateKey = process.env.RISK_AGENT_PRIVATE_KEY?.trim();
  if (requireSigner && (!agentPrivateKey || !isHexString(agentPrivateKey, 32))) {
    throw new Error("RISK_AGENT_PRIVATE_KEY must be a 32-byte private key for submission");
  }

  return {
    creditcoinRpcUrl: required("CREDITCOIN_RPC_URL"),
    evidenceRegistryAddress: address("EVIDENCE_REGISTRY_ADDRESS"),
    reserveControllerAddress: address("RESERVE_CONTROLLER_ADDRESS"),
    poolAddress: address("POOL_ADDRESS"),
    evidenceDeploymentBlock: nonNegativeInteger("EVIDENCE_DEPLOYMENT_BLOCK"),
    confirmations: positiveInteger("CREDITCOIN_CONFIRMATIONS", 1),
    geminiApiKey: required("GEMINI_API_KEY"),
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash",
    agentPrivateKey
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function address(name: string): string {
  try {
    return getAddress(required(name));
  } catch {
    throw new Error(`${name} must be a valid EVM address`);
  }
}

function nonNegativeInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}
