import {getBytes, isHexString, keccak256, toUtf8Bytes} from "ethers";

import {
  PortfolioFeatures,
  REASON_CODES,
  REGIMES,
  ReasonCode,
  Regime,
  ReservePolicy
} from "./domain.js";

export const DEFAULT_POLICY: ReservePolicy = {
  reserveBps: {NORMAL: 1_000, WATCH: 2_000, STRESS: 4_000, CRISIS: 6_000},
  minimumModelConfidenceBps: 6_000,
  modelVersionLabel: "proofreserve-risk-engine-v1",
  policyVersionLabel: "reserve-policy-v1"
};

export function validateFeatures(features: PortfolioFeatures): void {
  if (features.schemaVersion !== 1) throw new Error("unsupported feature schema");
  if (!Number.isSafeInteger(features.epoch) || features.epoch <= 0) throw new Error("invalid epoch");
  if (!isHexString(features.evidenceRoot, 32)) throw new Error("invalid evidence root");

  const integerFields = [
    features.evidenceCount,
    features.settledCount,
    features.lateCount,
    features.lossCount,
    features.deterioratingBorrowers,
    features.maxDeterioratingBorrowersInOneGroup,
    features.groupConcentrationBps,
    features.utilizationBps,
    features.evidenceAgeSeconds
  ];
  if (integerFields.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("feature counts and basis points must be non-negative integers");
  }
  if (features.groupConcentrationBps > 10_000 || features.utilizationBps > 10_000) {
    throw new Error("basis points cannot exceed 10000");
  }
  if (features.maxDeterioratingBorrowersInOneGroup > features.deterioratingBorrowers) {
    throw new Error("group deterioration cannot exceed total deterioration");
  }
  if (features.settledCount + features.lateCount + features.lossCount !== features.evidenceCount) {
    throw new Error("evidence counts do not reconcile");
  }

  for (const value of [features.settledValue, features.lateValue, features.lossValue]) {
    if (!/^\d+$/.test(value)) throw new Error("monetary features must be unsigned integer strings");
  }
  getBytes(features.evidenceRoot);
}

export function deterministicBaseline(features: PortfolioFeatures): {
  regime: Regime;
  reasonCodes: ReasonCode[];
  rationale: string;
} {
  const lossValue = BigInt(features.lossValue);
  const correlated = features.maxDeterioratingBorrowersInOneGroup >= 2;
  const highlyUtilized = features.utilizationBps >= 8_000;

  if (lossValue > 0n && (features.deterioratingBorrowers >= 2 || highlyUtilized)) {
    return {
      regime: "CRISIS",
      reasonCodes: ["REALIZED_LOSS", ...(highlyUtilized ? ["HIGH_UTILIZATION" as const] : [])],
      rationale: "Realized loss is combined with broad deterioration or high utilization."
    };
  }
  if (lossValue > 0n || (correlated && features.lateCount >= 2)) {
    return {
      regime: "STRESS",
      reasonCodes: lossValue > 0n ? ["REALIZED_LOSS"] : ["CORRELATED_LATENESS", "GROUP_CONCENTRATION"],
      rationale: "Loss or correlated lateness requires a materially larger reserve."
    };
  }
  if (features.evidenceCount < 3 || features.lateCount > 0 || highlyUtilized) {
    const reasons: ReasonCode[] = [];
    if (features.evidenceCount < 3) reasons.push("LIMITED_EVIDENCE");
    if (features.lateCount > 0) reasons.push("PAYMENT_VOLATILITY");
    if (highlyUtilized) reasons.push("HIGH_UTILIZATION");
    return {regime: "WATCH", reasonCodes: reasons, rationale: "One or more early warning signals are present."};
  }
  return {regime: "NORMAL", reasonCodes: ["HEALTHY_REPAYMENT"], rationale: "No adverse threshold is active."};
}

export function regimeIndex(regime: Regime): number {
  return REGIMES.indexOf(regime);
}

export function isReasonCode(value: string): value is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(value);
}

export function versionHash(label: string): string {
  return keccak256(toUtf8Bytes(label));
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
