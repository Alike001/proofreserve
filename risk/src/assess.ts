import {AbiCoder, keccak256, toUtf8Bytes} from "ethers";

import {
  ModelCandidate,
  PortfolioFeatures,
  REGIMES,
  Regime,
  ReservePolicy,
  RiskAssessment
} from "./domain.js";
import {GeminiClient} from "./gemini.js";
import {
  DEFAULT_POLICY,
  canonicalJson,
  deterministicBaseline,
  isReasonCode,
  regimeIndex,
  validateFeatures,
  versionHash
} from "./policy.js";

export async function assessPortfolio(
  features: PortfolioFeatures,
  client: Pick<GeminiClient, "assess">,
  policy: ReservePolicy = DEFAULT_POLICY
): Promise<RiskAssessment> {
  validateFeatures(features);
  const baseline = deterministicBaseline(features);
  let candidate: ModelCandidate | undefined;

  try {
    candidate = await client.assess(features);
  } catch (error) {
    if (process.env.RISK_MODEL_DEBUG?.trim().toLowerCase() === "true") {
      console.error("Gemini assessment rejected; using deterministic fallback:", error);
    }
    candidate = undefined;
  }

  let finalRegime: Regime = baseline.regime;
  let reasonCodes = baseline.reasonCodes;
  let confidenceBps = 10_000;
  let inferenceMode: RiskAssessment["inferenceMode"] = "DETERMINISTIC_FALLBACK";
  let rationale = baseline.rationale;

  if (
    candidate !== undefined && candidate.confidenceBps >= policy.minimumModelConfidenceBps
      && regimeIndex(candidate.regime) >= regimeIndex(baseline.regime)
  ) {
    finalRegime = candidate.regime;
    reasonCodes = candidate.reasonCodes;
    confidenceBps = candidate.confidenceBps;
    inferenceMode = "GEMINI";
    rationale = candidate.rationale;
  }

  const featureHash = keccak256(toUtf8Bytes(canonicalJson(features)));
  const reasonCodesHash = keccak256(AbiCoder.defaultAbiCoder().encode(["string[]"], [reasonCodes]));
  const modelVersion = versionHash(policy.modelVersionLabel);
  const policyVersion = versionHash(policy.policyVersionLabel);
  const finalRegimeIndex = regimeIndex(finalRegime);
  const reserveBps = policy.reserveBps[finalRegime];
  const decisionHash = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint16", "uint16", "uint64", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [
        finalRegimeIndex,
        reserveBps,
        confidenceBps,
        features.epoch,
        reasonCodesHash,
        features.evidenceRoot,
        featureHash,
        modelVersion,
        policyVersion
      ]
    )
  );

  return {
    regime: finalRegime,
    regimeIndex: finalRegimeIndex,
    reserveBps,
    confidenceBps,
    epoch: features.epoch,
    reasonCodes,
    reasonCodesHash,
    evidenceRoot: features.evidenceRoot,
    featureHash,
    modelVersion,
    policyVersion,
    decisionHash,
    inferenceMode,
    rationale
  };
}

export function validateRiskAssessment(
  features: PortfolioFeatures,
  assessment: RiskAssessment,
  policy: ReservePolicy = DEFAULT_POLICY
): void {
  validateFeatures(features);
  if (!(REGIMES as readonly string[]).includes(assessment.regime)) {
    throw new Error("assessment has an invalid regime");
  }
  const expectedRegimeIndex = regimeIndex(assessment.regime);
  if (assessment.regimeIndex !== expectedRegimeIndex) throw new Error("assessment regime index mismatch");
  if (assessment.reserveBps !== policy.reserveBps[assessment.regime]) {
    throw new Error("assessment reserve is outside policy");
  }
  if (
    !Number.isSafeInteger(assessment.confidenceBps) ||
    assessment.confidenceBps < 0 ||
    assessment.confidenceBps > 10_000
  ) {
    throw new Error("assessment confidence is invalid");
  }
  if (assessment.epoch !== features.epoch || assessment.evidenceRoot !== features.evidenceRoot) {
    throw new Error("assessment is not bound to its features");
  }
  if (
    !Array.isArray(assessment.reasonCodes) ||
    assessment.reasonCodes.length === 0 ||
    assessment.reasonCodes.some((reason) => !isReasonCode(reason))
  ) {
    throw new Error("assessment contains invalid reason codes");
  }
  if (new Set(assessment.reasonCodes).size !== assessment.reasonCodes.length) {
    throw new Error("assessment contains duplicate reason codes");
  }
  if (typeof assessment.rationale !== "string" || assessment.rationale.trim().length === 0) {
    throw new Error("assessment rationale is required");
  }

  const baseline = deterministicBaseline(features);
  if (assessment.inferenceMode === "GEMINI") {
    if (assessment.confidenceBps < policy.minimumModelConfidenceBps) {
      throw new Error("Gemini assessment is below the policy confidence floor");
    }
    if (assessment.regimeIndex < regimeIndex(baseline.regime)) {
      throw new Error("Gemini assessment lowers the deterministic safety floor");
    }
  } else if (assessment.inferenceMode === "DETERMINISTIC_FALLBACK") {
    if (
      assessment.regime !== baseline.regime ||
      assessment.confidenceBps !== 10_000 ||
      JSON.stringify(assessment.reasonCodes) !== JSON.stringify(baseline.reasonCodes)
    ) {
      throw new Error("fallback assessment does not match the deterministic baseline");
    }
  } else {
    throw new Error("assessment inference mode is invalid");
  }

  const expectedFeatureHash = keccak256(toUtf8Bytes(canonicalJson(features)));
  const expectedReasonCodesHash = keccak256(
    AbiCoder.defaultAbiCoder().encode(["string[]"], [assessment.reasonCodes])
  );
  const expectedModelVersion = versionHash(policy.modelVersionLabel);
  const expectedPolicyVersion = versionHash(policy.policyVersionLabel);
  if (assessment.featureHash !== expectedFeatureHash) throw new Error("assessment feature hash mismatch");
  if (assessment.reasonCodesHash !== expectedReasonCodesHash) {
    throw new Error("assessment reason-code hash mismatch");
  }
  if (assessment.modelVersion !== expectedModelVersion) throw new Error("assessment model version mismatch");
  if (assessment.policyVersion !== expectedPolicyVersion) throw new Error("assessment policy version mismatch");

  const expectedDecisionHash = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint16", "uint16", "uint64", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [
        assessment.regimeIndex,
        assessment.reserveBps,
        assessment.confidenceBps,
        assessment.epoch,
        assessment.reasonCodesHash,
        assessment.evidenceRoot,
        assessment.featureHash,
        assessment.modelVersion,
        assessment.policyVersion
      ]
    )
  );
  if (assessment.decisionHash !== expectedDecisionHash) throw new Error("assessment decision hash mismatch");
}
