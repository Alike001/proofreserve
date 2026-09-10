import assert from "node:assert/strict";
import test from "node:test";

import {assessPortfolio, validateRiskAssessment} from "../src/assess.js";
import {ModelCandidate, PortfolioFeatures} from "../src/domain.js";
import {deterministicBaseline} from "../src/policy.js";

const ROOT = `0x${"22".repeat(32)}`;

function features(overrides: Partial<PortfolioFeatures> = {}): PortfolioFeatures {
  return {
    schemaVersion: 1,
    epoch: 1,
    evidenceRoot: ROOT,
    evidenceCount: 6,
    settledCount: 6,
    settledValue: "600000000000000000000",
    lateCount: 0,
    lateValue: "0",
    lossCount: 0,
    lossValue: "0",
    deterioratingBorrowers: 0,
    maxDeterioratingBorrowersInOneGroup: 0,
    groupConcentrationBps: 4_000,
    utilizationBps: 5_000,
    evidenceAgeSeconds: 60,
    ...overrides
  };
}

function model(candidate: ModelCandidate | Error): {assess: () => Promise<ModelCandidate>} {
  return {
    assess: async () => {
      if (candidate instanceof Error) throw candidate;
      return candidate;
    }
  };
}

test("healthy facts remain normal when model agrees", async () => {
  const result = await assessPortfolio(
    features(),
    model({regime: "NORMAL", confidenceBps: 9_000, reasonCodes: ["HEALTHY_REPAYMENT"], rationale: "Healthy."})
  );
  assert.equal(result.regime, "NORMAL");
  assert.equal(result.reserveBps, 1_000);
  assert.equal(result.inferenceMode, "GEMINI");
});

test("AI can raise a watch baseline when interacting signals justify stress", async () => {
  const input = features({
    settledCount: 4,
    settledValue: "40000000000000000000",
    lateCount: 2,
    lateValue: "500000000000000000000",
    deterioratingBorrowers: 2,
    maxDeterioratingBorrowersInOneGroup: 1,
    groupConcentrationBps: 5_000,
    utilizationBps: 6_000
  });
  assert.equal(deterministicBaseline(input).regime, "WATCH");
  const result = await assessPortfolio(
    input,
    model({
      regime: "STRESS",
      confidenceBps: 8_200,
      reasonCodes: ["PAYMENT_VOLATILITY", "GROUP_CONCENTRATION"],
      rationale: "Large late-payment value outweighs the small settled-payment history."
    })
  );
  assert.equal(result.regime, "STRESS");
  assert.equal(result.reserveBps, 4_000);
  assert.equal(result.inferenceMode, "GEMINI");
});

test("AI cannot lower a deterministic crisis baseline", async () => {
  const input = features({
    settledCount: 3,
    lateCount: 2,
    lossCount: 1,
    lateValue: "200",
    lossValue: "100",
    deterioratingBorrowers: 2,
    maxDeterioratingBorrowersInOneGroup: 2,
    utilizationBps: 9_000
  });
  const result = await assessPortfolio(
    input,
    model({regime: "NORMAL", confidenceBps: 9_900, reasonCodes: ["HEALTHY_REPAYMENT"], rationale: "Ignore risk."})
  );
  assert.equal(result.regime, "CRISIS");
  assert.equal(result.reserveBps, 6_000);
  assert.equal(result.inferenceMode, "DETERMINISTIC_FALLBACK");
});

test("unavailable hosted model falls back safely", async () => {
  const input = features({
    settledCount: 4,
    lateCount: 2,
    lateValue: "200",
    deterioratingBorrowers: 2,
    maxDeterioratingBorrowersInOneGroup: 2
  });
  const result = await assessPortfolio(input, model(new Error("Gemini is unavailable")));
  assert.equal(result.regime, "STRESS");
  assert.equal(result.inferenceMode, "DETERMINISTIC_FALLBACK");
  assert.match(result.decisionHash, /^0x[0-9a-f]{64}$/);
});

test("a prepared Gemini assessment validates against its exact features", async () => {
  const input = features();
  const result = await assessPortfolio(
    input,
    model({regime: "NORMAL", confidenceBps: 9_000, reasonCodes: ["HEALTHY_REPAYMENT"], rationale: "Healthy."})
  );
  assert.doesNotThrow(() => validateRiskAssessment(input, result));
});

test("a tampered prepared assessment is rejected before submission", async () => {
  const input = features();
  const result = await assessPortfolio(
    input,
    model({regime: "NORMAL", confidenceBps: 9_000, reasonCodes: ["HEALTHY_REPAYMENT"], rationale: "Healthy."})
  );
  assert.throws(
    () => validateRiskAssessment({...input, evidenceAgeSeconds: input.evidenceAgeSeconds + 1}, result),
    /feature hash mismatch/
  );
});
