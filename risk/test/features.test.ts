import assert from "node:assert/strict";
import test from "node:test";

import {AcceptedFact, PortfolioSnapshot, buildPortfolioFeatures} from "../src/features.js";

const ROOT_1 = `0x${"11".repeat(32)}`;
const ROOT_2 = `0x${"22".repeat(32)}`;
const GROUP_A = `0x${"aa".repeat(32)}`;
const GROUP_B = `0x${"bb".repeat(32)}`;

function snapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    epoch: 1,
    evidenceRoot: ROOT_2,
    checkpointFactCount: 3,
    checkpointClosedAt: 1_000,
    observedAt: 1_060,
    settledCount: 1,
    settledValue: "600",
    lateCount: 2,
    lateValue: "400",
    lossCount: 0,
    lossValue: "0",
    totalManagedAssets: "1000",
    totalCommitments: "300",
    totalPrincipalOutstanding: "500",
    ...overrides
  };
}

function facts(): AcceptedFact[] {
  return [
    {
      factType: 1,
      borrower: "0x0000000000000000000000000000000000000001",
      groupId: GROUP_B,
      amount: "600",
      epoch: 1,
      evidenceRoot: ROOT_1
    },
    {
      factType: 2,
      borrower: "0x0000000000000000000000000000000000000002",
      groupId: GROUP_A,
      amount: "200",
      epoch: 1,
      evidenceRoot: `0x${"21".repeat(32)}`
    },
    {
      factType: 2,
      borrower: "0x0000000000000000000000000000000000000003",
      groupId: GROUP_A,
      amount: "200",
      epoch: 1,
      evidenceRoot: ROOT_2
    }
  ];
}

test("builds deterministic features from accepted facts and pool state", () => {
  const result = buildPortfolioFeatures(snapshot(), facts());
  assert.deepEqual(result, {
    schemaVersion: 1,
    epoch: 1,
    evidenceRoot: ROOT_2,
    evidenceCount: 3,
    settledCount: 1,
    settledValue: "600",
    lateCount: 2,
    lateValue: "400",
    lossCount: 0,
    lossValue: "0",
    deterioratingBorrowers: 2,
    maxDeterioratingBorrowersInOneGroup: 2,
    groupConcentrationBps: 10_000,
    utilizationBps: 8_000,
    evidenceAgeSeconds: 60
  });
});

test("counts one deteriorating borrower once across late and loss facts", () => {
  const inputFacts = facts();
  inputFacts[2] = {...inputFacts[2]!, factType: 3, borrower: inputFacts[1]!.borrower};
  const result = buildPortfolioFeatures(
    snapshot({lateCount: 1, lateValue: "200", lossCount: 1, lossValue: "200"}),
    inputFacts
  );
  assert.equal(result.deterioratingBorrowers, 1);
  assert.equal(result.maxDeterioratingBorrowersInOneGroup, 1);
});

test("rejects an incomplete log range instead of assessing partial evidence", () => {
  assert.throws(() => buildPortfolioFeatures(snapshot(), facts().slice(0, 2)), /accepted fact count mismatch/);
});

test("rejects logs whose final rolling root does not match the checkpoint", () => {
  const inputFacts = facts();
  inputFacts[2] = {...inputFacts[2]!, evidenceRoot: ROOT_1};
  assert.throws(() => buildPortfolioFeatures(snapshot(), inputFacts), /checkpoint root/);
});

test("rejects logs that disagree with canonical on-chain aggregates", () => {
  assert.throws(() => buildPortfolioFeatures(snapshot({lateValue: "401"}), facts()), /late value/);
});
