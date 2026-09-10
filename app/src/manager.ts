import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  formatUnits,
  getAddress,
  isAddress,
  isError,
  parseUnits,
  type Eip1193Provider
} from "ethers";

export const DEFAULT_MANAGER_BORROWER = "0x000000000000000000000000000000000000B001";

const CREDITCOIN_CHAIN_ID = 102_031n;
const CREDITCOIN_CHAIN_HEX = "0x18e8f";
const DEFAULT_CC3_RPC = "https://rpc.cc3-testnet.creditcoin.network";
const DEFAULT_CC3_EXPLORER = "https://creditcoin-testnet.blockscout.com";
const POOL_ABI = [
  "function owner() view returns (address)",
  "function lendable() view returns (uint256)",
  "function commitments(address borrower) view returns (uint256)",
  "function commitLoan(address borrower,uint256 amount)",
  "function cancelCommitment(address borrower,uint256 amount)",
  "error InsufficientLendable(uint256 available,uint256 requested)",
  "error InsufficientCommitment(uint256 available,uint256 requested)",
  "error OwnableUnauthorizedAccount(address account)"
];

export interface InjectedWalletProvider extends Eip1193Provider {
  on?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
}

export interface ManagerState {
  account: string;
  owner: string;
  authorized: boolean;
  borrower: string;
  borrowerCommitment: string;
  lendable: number;
}

export interface ManagerTransaction {
  transactionHash: string;
  blockNumber: number;
  state: ManagerState;
}

interface ManagerSession {
  contract: Contract;
  account: string;
  owner: string;
}

export function injectedWallet(): InjectedWalletProvider | null {
  return (window as Window & {ethereum?: InjectedWalletProvider}).ethereum ?? null;
}

export function parseManagerRequest(borrower: string, amount: string): {borrower: string; amount: bigint} {
  if (!isAddress(borrower) || getAddress(borrower) === ZeroAddress) {
    throw new Error("Enter a valid non-zero borrower address.");
  }
  if (!/^\d+(\.\d{1,18})?$/.test(amount.trim())) {
    throw new Error("Enter a positive prUSD amount with no more than 18 decimals.");
  }
  const value = parseUnits(amount.trim(), 18);
  if (value === 0n) throw new Error("The commitment amount must be greater than zero.");
  return {borrower: getAddress(borrower), amount: value};
}

export function managerExplorerUrl(transactionHash: string): string {
  const configured = import.meta.env.VITE_CC3_EXPLORER_TX_URL?.trim();
  if (configured) return `${configured}${transactionHash}`;
  return `${DEFAULT_CC3_EXPLORER}/tx/${transactionHash}`;
}

export async function connectPoolManager(borrower = DEFAULT_MANAGER_BORROWER): Promise<ManagerState> {
  const session = await managerSession(true);
  return readManagerState(session, getAddress(borrower));
}

export async function preflightPoolCommitment(borrower: string, amount: string): Promise<ManagerState> {
  const request = parseManagerRequest(borrower, amount);
  const session = await managerSession(false);
  requireOwner(session);
  await session.contract.getFunction("commitLoan").staticCall(request.borrower, request.amount);
  return readManagerState(session, request.borrower);
}

export async function commitPoolLoan(borrower: string, amount: string): Promise<ManagerTransaction> {
  const request = parseManagerRequest(borrower, amount);
  const session = await managerSession(false);
  requireOwner(session);
  const method = session.contract.getFunction("commitLoan");
  await method.staticCall(request.borrower, request.amount);
  const estimate = await method.estimateGas(request.borrower, request.amount);
  const transaction = await method.send(request.borrower, request.amount, {gasLimit: (estimate * 120n) / 100n});
  const receipt = await transaction.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("The Creditcoin commitment transaction failed.");
  return {
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
    state: await readManagerState(session, request.borrower)
  };
}

export async function cancelPoolLoan(borrower: string, amount: string): Promise<ManagerTransaction> {
  const request = parseManagerRequest(borrower, amount);
  const session = await managerSession(false);
  requireOwner(session);
  const method = session.contract.getFunction("cancelCommitment");
  await method.staticCall(request.borrower, request.amount);
  const estimate = await method.estimateGas(request.borrower, request.amount);
  const transaction = await method.send(request.borrower, request.amount, {gasLimit: (estimate * 120n) / 100n});
  const receipt = await transaction.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("The Creditcoin cancellation transaction failed.");
  return {
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
    state: await readManagerState(session, request.borrower)
  };
}

export function managerErrorMessage(error: unknown): string {
  const code = walletErrorCode(error);
  if (code === 4001) return "The wallet request was declined.";
  if (error instanceof Error && error.message.startsWith("Enter ")) return error.message;
  if (error instanceof Error && error.message.includes("owner wallet")) return error.message;
  if (isError(error, "CALL_EXCEPTION")) {
    const parsed = error.revert;
    if (parsed?.name === "InsufficientLendable") {
      return `Only ${formatUnits(parsed.args[0] as bigint, 18)} prUSD is currently lendable.`;
    }
    if (parsed?.name === "InsufficientCommitment") {
      return `Only ${formatUnits(parsed.args[0] as bigint, 18)} prUSD is committed for this borrower.`;
    }
    if (parsed?.name === "OwnableUnauthorizedAccount") return "Only the deployed pool owner can perform this action.";
  }
  return error instanceof Error ? error.message : "The wallet action could not be completed.";
}

async function managerSession(requestAccounts: boolean): Promise<ManagerSession> {
  const injected = injectedWallet();
  if (!injected) throw new Error("Install an EVM wallet such as MetaMask to use the manager desk.");
  await ensureCreditcoinNetwork(injected);
  const provider = new BrowserProvider(injected);
  if (requestAccounts) await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  if (network.chainId !== CREDITCOIN_CHAIN_ID) throw new Error("Switch the connected wallet to Creditcoin CC3 Testnet.");

  const poolAddress = import.meta.env.VITE_POOL_ADDRESS?.trim();
  if (!poolAddress || !isAddress(poolAddress)) throw new Error("The deployed pool address is unavailable in this build.");
  const contract = new Contract(poolAddress, POOL_ABI, signer);
  const [account, owner] = await Promise.all([signer.getAddress(), contract.getFunction("owner").staticCall()]);
  return {contract, account: getAddress(account), owner: getAddress(String(owner))};
}

async function readManagerState(session: ManagerSession, borrower: string): Promise<ManagerState> {
  const [lendable, commitment] = await Promise.all([
    session.contract.getFunction("lendable").staticCall(),
    session.contract.getFunction("commitments").staticCall(borrower)
  ]);
  return {
    account: session.account,
    owner: session.owner,
    authorized: session.account === session.owner,
    borrower,
    borrowerCommitment: formatUnits(commitment, 18),
    lendable: Number(formatUnits(lendable, 18))
  };
}

function requireOwner(session: ManagerSession): void {
  if (session.account !== session.owner) {
    throw new Error(`Connect the pool owner wallet (${shortAddress(session.owner)}) to authorize this action.`);
  }
}

async function ensureCreditcoinNetwork(provider: InjectedWalletProvider): Promise<void> {
  const chainId = await provider.request({method: "eth_chainId"});
  if (typeof chainId === "string" && BigInt(chainId) === CREDITCOIN_CHAIN_ID) return;
  try {
    await provider.request({method: "wallet_switchEthereumChain", params: [{chainId: CREDITCOIN_CHAIN_HEX}]});
  } catch (error) {
    if (walletErrorCode(error) !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CREDITCOIN_CHAIN_HEX,
        chainName: "Creditcoin CC3 Testnet",
        nativeCurrency: {name: "Creditcoin", symbol: "CTC", decimals: 18},
        rpcUrls: [import.meta.env.VITE_CREDITCOIN_RPC_URL?.trim() || DEFAULT_CC3_RPC],
        blockExplorerUrls: [DEFAULT_CC3_EXPLORER]
      }]
    });
  }
}

function walletErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {code?: unknown; info?: {error?: {code?: unknown}}};
  if (typeof candidate.code === "number") return candidate.code;
  return typeof candidate.info?.error?.code === "number" ? candidate.info.error.code : undefined;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
