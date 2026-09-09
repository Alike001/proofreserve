import {Contract} from "ethers";

export interface TransactionRecord {
  action: string;
  transactionHash: string;
  blockNumber: number;
}

export async function readContract(
  contract: Contract,
  methodName: string,
  args: readonly unknown[] = []
): Promise<unknown> {
  return contract.getFunction(methodName).staticCall(...args);
}

export async function sendContractTransaction(
  contract: Contract,
  methodName: string,
  args: readonly unknown[],
  confirmations: number,
  action: string
): Promise<TransactionRecord> {
  const method = contract.getFunction(methodName);
  await method.staticCall(...args);
  const estimate = await method.estimateGas(...args);
  const transaction = await method.send(...args, {gasLimit: (estimate * 120n) / 100n});
  const receipt = await transaction.wait(confirmations);
  if (!receipt || receipt.status !== 1) throw new Error(`${action} transaction failed`);
  return {action, transactionHash: transaction.hash, blockNumber: receipt.blockNumber};
}

export function configuredBorrowers(): string[] {
  const configured = process.env.DEMO_BORROWER_ADDRESSES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length
    ? configured
    : [
        "0x000000000000000000000000000000000000b001",
        "0x000000000000000000000000000000000000b002",
        "0x000000000000000000000000000000000000b003"
      ];
}
