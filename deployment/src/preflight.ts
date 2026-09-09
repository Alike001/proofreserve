import {chainInfo} from "@gluwa/usc-sdk";
import {JsonRpcProvider, Wallet, formatEther, getAddress, isHexString} from "ethers";

interface AccountCheck {
  role: string;
  chain: "SOURCE" | "CREDITCOIN";
  address: string;
  nativeBalance: string;
  funded: boolean;
}

const errors: string[] = [];

function configured(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is missing`);
  return value || undefined;
}

function configuredInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer`);
    return fallback;
  }
  return value;
}

function walletFor(
  role: string,
  keyName: string,
  privateKey: string,
  provider: JsonRpcProvider
): Wallet | undefined {
  if (!isHexString(privateKey, 32)) {
    errors.push(`${keyName} must be a 32-byte private key`);
    return undefined;
  }
  try {
    return new Wallet(privateKey, provider);
  } catch {
    errors.push(`${keyName} is not a valid ${role} key`);
    return undefined;
  }
}

async function verifyNetwork(
  label: string,
  provider: JsonRpcProvider,
  expectedChainId: number
): Promise<{chainId: number; latestBlock: number} | undefined> {
  try {
    const [network, latestBlock] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
    const chainId = Number(network.chainId);
    if (chainId !== expectedChainId) {
      errors.push(`${label} RPC returned chain ${chainId}; expected ${expectedChainId}`);
    }
    return {chainId, latestBlock};
  } catch (error) {
    errors.push(`${label} RPC is unreachable: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function accountCheck(
  role: string,
  chain: AccountCheck["chain"],
  wallet: Wallet | undefined,
  provider: JsonRpcProvider
): Promise<AccountCheck | undefined> {
  if (!wallet) return undefined;
  const address = await wallet.getAddress();
  try {
    const balance = await provider.getBalance(address);
    const funded = balance > 0n;
    if (!funded) errors.push(`${role} ${address} has no native ${chain.toLowerCase()} testnet gas`);
    return {role, chain, address, nativeBalance: formatEther(balance), funded};
  } catch (error) {
    errors.push(`cannot read ${role} balance: ${error instanceof Error ? error.message : String(error)}`);
    return {role, chain, address, nativeBalance: "unavailable", funded: false};
  }
}

const sourceRpcUrl = configured("SOURCE_CHAIN_RPC_URL");
const creditcoinRpcUrl = configured("CREDITCOIN_RPC_URL");
const proofBuilderUrl = configured("PROOF_BUILDER_URL");
const configuredRiskAgentAddress = configured("RISK_AGENT_ADDRESS");
const sourceDeployerPrivateKey = configured("SOURCE_DEPLOYER_PRIVATE_KEY");
const creditcoinDeployerPrivateKey = configured("CREDITCOIN_DEPLOYER_PRIVATE_KEY");
const workerPrivateKey = configured("CREDITCOIN_WORKER_PRIVATE_KEY");
const riskAgentPrivateKey = configured("RISK_AGENT_PRIVATE_KEY");
const sourceChainId = configuredInteger("SOURCE_CHAIN_ID", 11_155_111);
const creditcoinChainId = configuredInteger("CREDITCOIN_CHAIN_ID", 102_031);
const sourceChainKey = configuredInteger("SOURCE_CHAIN_KEY", 1);

if (
  !sourceRpcUrl ||
  !creditcoinRpcUrl ||
  !proofBuilderUrl ||
  !configuredRiskAgentAddress ||
  !sourceDeployerPrivateKey ||
  !creditcoinDeployerPrivateKey ||
  !workerPrivateKey ||
  !riskAgentPrivateKey
) {
  console.error(JSON.stringify({ready: false, errors}, null, 2));
  process.exitCode = 1;
} else {
  const sourceProvider = new JsonRpcProvider(sourceRpcUrl);
  const creditcoinProvider = new JsonRpcProvider(creditcoinRpcUrl);
  const sourceDeployer = walletFor(
    "source deployer",
    "SOURCE_DEPLOYER_PRIVATE_KEY",
    sourceDeployerPrivateKey,
    sourceProvider
  );
  const creditcoinDeployer = walletFor(
    "Creditcoin deployer",
    "CREDITCOIN_DEPLOYER_PRIVATE_KEY",
    creditcoinDeployerPrivateKey,
    creditcoinProvider
  );
  const worker = walletFor(
    "Attestcoin worker",
    "CREDITCOIN_WORKER_PRIVATE_KEY",
    workerPrivateKey,
    creditcoinProvider
  );
  const riskAgent = walletFor("risk agent", "RISK_AGENT_PRIVATE_KEY", riskAgentPrivateKey, creditcoinProvider);

  const [sourceNetwork, creditcoinNetwork, sourceAccount, deployerAccount, workerAccount, riskAccount] =
    await Promise.all([
      verifyNetwork("source", sourceProvider, sourceChainId),
      verifyNetwork("Creditcoin", creditcoinProvider, creditcoinChainId),
      accountCheck("source deployer", "SOURCE", sourceDeployer, sourceProvider),
      accountCheck("Creditcoin deployer", "CREDITCOIN", creditcoinDeployer, creditcoinProvider),
      accountCheck("Attestcoin worker", "CREDITCOIN", worker, creditcoinProvider),
      accountCheck("risk agent", "CREDITCOIN", riskAgent, creditcoinProvider)
    ]);

  let normalizedRiskAgentAddress: string | undefined;
  try {
    normalizedRiskAgentAddress = getAddress(configuredRiskAgentAddress);
  } catch {
    errors.push("RISK_AGENT_ADDRESS is not a valid EVM address");
  }
  if (normalizedRiskAgentAddress && riskAccount?.address !== normalizedRiskAgentAddress) {
    errors.push(
      `RISK_AGENT_PRIVATE_KEY resolves to ${riskAccount?.address ?? "no address"}, not RISK_AGENT_ADDRESS ${normalizedRiskAgentAddress}`
    );
  }

  const creditcoinRoleAddresses = [deployerAccount?.address, workerAccount?.address, riskAccount?.address].filter(
    (address): address is string => Boolean(address)
  );
  if (new Set(creditcoinRoleAddresses).size !== creditcoinRoleAddresses.length) {
    errors.push("Creditcoin deployer, Attestcoin worker, and risk agent must use separate testnet accounts");
  }

  let supportedSource:
    | {chainKey: number; chainId: number; chainName: string; chainEncoding: number}
    | undefined;
  try {
    // usc-sdk and the app may resolve ethers through separate package paths, so their
    // nominal private-field types differ even though the provider is runtime-compatible.
    type ChainInfoRpc = ConstructorParameters<typeof chainInfo.PrecompileChainInfoProvider>[0];
    const provider = new chainInfo.PrecompileChainInfoProvider(
      creditcoinProvider as unknown as ChainInfoRpc
    );
    const chains = await provider.getSupportedChains();
    const match = chains.find((chain) => Number(chain.chainKey) === sourceChainKey);
    if (!match) {
      errors.push(`Creditcoin does not report source chain key ${sourceChainKey} as supported`);
    } else {
      supportedSource = {
        chainKey: Number(match.chainKey),
        chainId: Number(match.chainId),
        chainName: match.chainName,
        chainEncoding: Number(match.chainEncoding)
      };
      if (supportedSource.chainId !== sourceChainId) {
        errors.push(
          `source chain key ${sourceChainKey} maps to chain ID ${supportedSource.chainId}, not configured ${sourceChainId}`
        );
      }
    }
  } catch (error) {
    errors.push(
      `cannot query Attestcoin supported chains: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let latestAttestedHeight: number | undefined;
  try {
    const baseUrl = proofBuilderUrl.endsWith("/") ? proofBuilderUrl : `${proofBuilderUrl}/`;
    const response = await fetch(new URL(`api/v1/attested-height/${sourceChainKey}`, baseUrl), {
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as {attestedHeight?: unknown};
    if (!Number.isSafeInteger(payload.attestedHeight) || Number(payload.attestedHeight) < 0) {
      throw new Error("response does not contain a valid attestedHeight");
    }
    latestAttestedHeight = Number(payload.attestedHeight);
  } catch (error) {
    errors.push(`proof builder is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  const report = {
    ready: errors.length === 0,
    networks: {source: sourceNetwork, creditcoin: creditcoinNetwork},
    attestcoin: {supportedSource, latestAttestedHeight},
    accounts: [sourceAccount, deployerAccount, workerAccount, riskAccount].filter(Boolean),
    errors
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 1;
}
