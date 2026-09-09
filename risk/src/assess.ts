import {AbiCoder, keccak256, toUtf8Bytes} from "ethers";

import {ModelCandidate, PortfolioFeatures, Regime, ReservePolicy, RiskAssessment} from "./domain.js";
import {GeminiClient} from "./gemini.js";
import {
  DEFAULT_POLICY,
  canonicalJson,
  deterministicBaseline,
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
  } catch {
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
