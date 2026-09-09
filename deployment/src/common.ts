import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {dirname} from "node:path";

import {
  ContractFactory,
  InterfaceAbi,
  JsonRpcProvider,
  NonceManager,
  Wallet,
  isHexString,
  type Signer
} from "ethers";

interface ForgeArtifact {
  abi: InterfaceAbi;
  bytecode: {object: string};
}

export interface DeploymentRecord {
  address: string;
  transactionHash: string;
  blockNumber: number;
}

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function environmentInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

export function environmentPrivateKey(name: string): string {
  const value = required(name);
  if (!isHexString(value, 32)) throw new Error(`${name} must be a 32-byte private key`);
  return value;
}

export async function deploymentContext(
  rpcEnvironmentName: string,
  privateKeyEnvironmentName: string,
  expectedChainId: number
): Promise<{provider: JsonRpcProvider; signer: NonceManager; chainId: number}> {
  const provider = new JsonRpcProvider(required(rpcEnvironmentName));
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== expectedChainId) {
    throw new Error(`wrong chain for ${rpcEnvironmentName}: expected ${expectedChainId}, received ${chainId}`);
  }

  const signer = new Wallet(environmentPrivateKey(privateKeyEnvironmentName), provider);
  const signerAddress = await signer.getAddress();
  const balance = await provider.getBalance(signerAddress);
  if (balance === 0n) throw new Error(`deployer ${signerAddress} has no native testnet gas`);
  return {provider, signer: new NonceManager(signer), chainId};
}

export async function deployContract(
  sourceName: string,
  contractName: string,
  signer: Signer,
  constructorArguments: readonly unknown[],
  confirmations: number
): Promise<DeploymentRecord> {
  const artifactPath = `contracts/out/${sourceName}.sol/${contractName}.json`;
  let artifact: ForgeArtifact;
  try {
    artifact = JSON.parse(await readFile(artifactPath, "utf8")) as ForgeArtifact;
  } catch (error) {
    throw new Error(`cannot read ${artifactPath}; run pnpm build:contracts first`, {cause: error});
  }
  if (!artifact.abi || !artifact.bytecode?.object) {
    throw new Error(`invalid Forge artifact: ${artifactPath}`);
  }

  const factory = new ContractFactory(artifact.abi, artifact.bytecode.object, signer);
  const contract = await factory.deploy(...constructorArguments);
  const transaction = contract.deploymentTransaction();
  if (!transaction) throw new Error(`${contractName} deployment transaction is unavailable`);
  const receipt = await transaction.wait(confirmations);
  if (!receipt || receipt.status !== 1) throw new Error(`${contractName} deployment failed`);
  return {
    address: await contract.getAddress(),
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber
  };
}

export async function writeManifest(path: string, manifest: unknown): Promise<void> {
  await mkdir(dirname(path), {recursive: true});
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o644});
  await rename(temporaryPath, path);
}
