import assert from "node:assert/strict";
import test from "node:test";

import {RiskAssessment} from "../src/domain.js";
import {controllerAssessmentTuple} from "../src/onchain.js";

test("maps only the closed assessment fields into the controller tuple", () => {
  const assessment: RiskAssessment = {
    regime: "STRESS",
    regimeIndex: 2,
    reserveBps: 4_000,
    confidenceBps: 8_500,
    epoch: 7,
    reasonCodes: ["CORRELATED_LATENESS", "GROUP_CONCENTRATION"],
    reasonCodesHash: `0x${"11".repeat(32)}`,
    evidenceRoot: `0x${"22".repeat(32)}`,
    featureHash: `0x${"33".repeat(32)}`,
    modelVersion: `0x${"44".repeat(32)}`,
    policyVersion: `0x${"55".repeat(32)}`,
    decisionHash: `0x${"66".repeat(32)}`,
    inferenceMode: "GEMINI",
    rationale: "Correlated risk is elevated."
  };

  assert.deepEqual(controllerAssessmentTuple(assessment), {
    regime: 2,
    reserveBps: 4_000,
    confidenceBps: 8_500,
    epoch: 7,
    reasonCodesHash: `0x${"11".repeat(32)}`,
    evidenceRoot: `0x${"22".repeat(32)}`,
    featureHash: `0x${"33".repeat(32)}`,
    modelVersion: `0x${"44".repeat(32)}`,
    policyVersion: `0x${"55".repeat(32)}`,
    decisionHash: `0x${"66".repeat(32)}`
  });
});
