import {getAddress, isHexString} from "ethers";

import {PortfolioFeatures} from "./domain.js";

export const FACT_TYPE = {
  PAYMENT_SETTLED: 1,
  PAYMENT_LATE: 2,
  LOSS_REALIZED: 3
} as const;

export interface AcceptedFact {
  factType: number;
  borrower: string;
  groupId: string;
  amount: string;
  epoch: number;
  evidenceRoot: string;
}

export interface PortfolioSnapshot {
  epoch: number;
  evidenceRoot: string;
  checkpointFactCount: number;
  checkpointClosedAt: number;
  observedAt: number;
  settledCount: number;
  settledValue: string;
  lateCount: number;
  lateValue: string;
  lossCount: number;
  lossValue: string;
  totalManagedAssets: string;
  totalCommitments: string;
  totalPrincipalOutstanding: string;
}

export function buildPortfolioFeatures(snapshot: PortfolioSnapshot, facts: AcceptedFact[]): PortfolioFeatures {
  requireSnapshot(snapshot);
  if (facts.length !== snapshot.checkpointFactCount) {
    throw new Error(`accepted fact count mismatch: expected ${snapshot.checkpointFactCount}, found ${facts.length}`);
  }

  const counts = {settled: 0, late: 0, loss: 0};
  const values = {settled: 0n, late: 0n, loss: 0n};
  const adverseBorrowers = new Map<string, string>();

  for (const fact of facts) {
    if (fact.epoch !== snapshot.epoch) throw new Error("accepted fact belongs to a different epoch");
    if (!isHexString(fact.evidenceRoot, 32)) throw new Error("accepted fact has an invalid evidence root");
    const amount = unsignedBigInt(fact.amount, "fact amount");

    if (fact.factType === FACT_TYPE.PAYMENT_SETTLED) {
      counts.settled += 1;
      values.settled += amount;
    } else if (fact.factType === FACT_TYPE.PAYMENT_LATE) {
      counts.late += 1;
      values.late += amount;
      addAdverseBorrower(adverseBorrowers, fact);
    } else if (fact.factType === FACT_TYPE.LOSS_REALIZED) {
      counts.loss += 1;
      values.loss += amount;
      addAdverseBorrower(adverseBorrowers, fact);
    } else {
      throw new Error(`unsupported accepted fact type: ${fact.factType}`);
    }
  }

  if (facts.length > 0 && facts.at(-1)?.evidenceRoot.toLowerCase() !== snapshot.evidenceRoot.toLowerCase()) {
    throw new Error("final accepted-fact root does not match the checkpoint root");
  }
  requireAggregate("settled", counts.settled, values.settled, snapshot.settledCount, snapshot.settledValue);
  requireAggregate("late", counts.late, values.late, snapshot.lateCount, snapshot.lateValue);
  requireAggregate("loss", counts.loss, values.loss, snapshot.lossCount, snapshot.lossValue);

  const borrowersByGroup = new Map<string, Set<string>>();
  for (const [borrower, groupId] of adverseBorrowers) {
    const members = borrowersByGroup.get(groupId) ?? new Set<string>();
    members.add(borrower);
    borrowersByGroup.set(groupId, members);
  }
  const maxDeterioratingBorrowersInOneGroup = Math.max(
    0,
    ...[...borrowersByGroup.values()].map((members) => members.size)
  );
  const deterioratingBorrowers = adverseBorrowers.size;
  const groupConcentrationBps = deterioratingBorrowers === 0
    ? 0
    : Math.floor((maxDeterioratingBorrowersInOneGroup * 10_000) / deterioratingBorrowers);

  const managedAssets = unsignedBigInt(snapshot.totalManagedAssets, "total managed assets");
  const utilized = unsignedBigInt(snapshot.totalCommitments, "total commitments")
    + unsignedBigInt(snapshot.totalPrincipalOutstanding, "total principal outstanding");
  const utilizationBps = managedAssets === 0n
    ? 0
    : Number(minBigInt(10_000n, (utilized * 10_000n) / managedAssets));

  return {
    schemaVersion: 1,
    epoch: snapshot.epoch,
    evidenceRoot: snapshot.evidenceRoot,
    evidenceCount: facts.length,
    settledCount: counts.settled,
    settledValue: values.settled.toString(),
    lateCount: counts.late,
    lateValue: values.late.toString(),
    lossCount: counts.loss,
    lossValue: values.loss.toString(),
    deterioratingBorrowers,
    maxDeterioratingBorrowersInOneGroup,
    groupConcentrationBps,
    utilizationBps,
    evidenceAgeSeconds: Math.max(0, snapshot.observedAt - snapshot.checkpointClosedAt)
  };
}

function addAdverseBorrower(target: Map<string, string>, fact: AcceptedFact): void {
  const borrower = getAddress(fact.borrower);
  if (!isHexString(fact.groupId, 32)) throw new Error("accepted fact has an invalid group ID");
  const groupId = fact.groupId.toLowerCase();
  const existingGroup = target.get(borrower);
  if (existingGroup && existingGroup !== groupId) throw new Error("borrower changed groups inside one epoch");
  target.set(borrower, groupId);
}

function requireSnapshot(snapshot: PortfolioSnapshot): void {
  for (const [label, value] of [
    ["epoch", snapshot.epoch],
    ["checkpoint fact count", snapshot.checkpointFactCount],
    ["checkpoint close time", snapshot.checkpointClosedAt],
    ["observation time", snapshot.observedAt],
    ["settled count", snapshot.settledCount],
    ["late count", snapshot.lateCount],
    ["loss count", snapshot.lossCount]
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  }
  if (snapshot.epoch === 0) throw new Error("epoch must be positive");
  if (!isHexString(snapshot.evidenceRoot, 32) || /^0x0{64}$/i.test(snapshot.evidenceRoot)) {
    throw new Error("checkpoint evidence root is missing or invalid");
  }
}

function requireAggregate(
  label: string,
  derivedCount: number,
  derivedValue: bigint,
  expectedCount: number,
  expectedValue: string
): void {
  if (derivedCount !== expectedCount) throw new Error(`${label} count does not match on-chain aggregate`);
  if (derivedValue !== unsignedBigInt(expectedValue, `${label} value`)) {
    throw new Error(`${label} value does not match on-chain aggregate`);
  }
}

function unsignedBigInt(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an unsigned integer string`);
  return BigInt(value);
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}
