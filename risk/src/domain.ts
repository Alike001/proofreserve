export const REGIMES = ["NORMAL", "WATCH", "STRESS", "CRISIS"] as const;
export type Regime = (typeof REGIMES)[number];

export const REASON_CODES = [
  "HEALTHY_REPAYMENT",
  "LIMITED_EVIDENCE",
  "HIGH_UTILIZATION",
  "CORRELATED_LATENESS",
  "GROUP_CONCENTRATION",
  "REALIZED_LOSS",
  "PAYMENT_VOLATILITY"
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface PortfolioFeatures {
  schemaVersion: 1;
  epoch: number;
  evidenceRoot: string;
  evidenceCount: number;
  settledCount: number;
  settledValue: string;
  lateCount: number;
  lateValue: string;
  lossCount: number;
  lossValue: string;
  deterioratingBorrowers: number;
  maxDeterioratingBorrowersInOneGroup: number;
  groupConcentrationBps: number;
  utilizationBps: number;
  evidenceAgeSeconds: number;
}

export interface ModelCandidate {
  regime: Regime;
  confidenceBps: number;
  reasonCodes: ReasonCode[];
  rationale: string;
}

export interface RiskAssessment {
  regime: Regime;
  regimeIndex: number;
  reserveBps: number;
  confidenceBps: number;
  epoch: number;
  reasonCodes: ReasonCode[];
  reasonCodesHash: string;
  evidenceRoot: string;
  featureHash: string;
  modelVersion: string;
  policyVersion: string;
  decisionHash: string;
  inferenceMode: "GEMINI" | "DETERMINISTIC_FALLBACK";
  rationale: string;
}

export interface ReservePolicy {
  reserveBps: Record<Regime, number>;
  minimumModelConfidenceBps: number;
  modelVersionLabel: string;
  policyVersionLabel: string;
}
