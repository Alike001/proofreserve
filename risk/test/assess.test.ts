import assert from "node:assert/strict";
import test from "node:test";

import {assessPortfolio} from "../src/assess.js";
import {ModelCandidate, PortfolioFeatures} from "../src/domain.js";

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
  assert.equal(result.inferenceMode, "OLLAMA");
});

test("AI can raise a watch baseline when interacting signals justify stress", async () => {
  const input = features({
    settledCount: 4,
    lateCount: 2,
    lateValue: "200000000000000000000",
    deterioratingBorrowers: 2,
    maxDeterioratingBorrowersInOneGroup: 1,
    groupConcentrationBps: 7_500,
    utilizationBps: 7_900
  });
  const result = await assessPortfolio(
    input,
    model({
      regime: "STRESS",
      confidenceBps: 8_200,
      reasonCodes: ["PAYMENT_VOLATILITY", "GROUP_CONCENTRATION"],
      rationale: "Lateness and concentration interact near high utilization."
    })
  );
  assert.equal(result.regime, "STRESS");
  assert.equal(result.reserveBps, 4_000);
  assert.equal(result.inferenceMode, "OLLAMA");
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

test("unavailable model falls back without a paid API", async () => {
  const input = features({
    settledCount: 4,
    lateCount: 2,
    lateValue: "200",
    deterioratingBorrowers: 2,
    maxDeterioratingBorrowersInOneGroup: 2
  });
  const result = await assessPortfolio(input, model(new Error("Ollama is offline")));
  assert.equal(result.regime, "STRESS");
  assert.equal(result.inferenceMode, "DETERMINISTIC_FALLBACK");
  assert.match(result.decisionHash, /^0x[0-9a-f]{64}$/);
});
