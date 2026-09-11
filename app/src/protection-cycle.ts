export const PROTECTION_CYCLE_STEP_COUNT = 6;

export type ProtectionCycleStatus = "idle" | "querying" | "playing" | "complete" | "error";
export type ProtectionCycleStepState = "waiting" | "active" | "complete";

export function protectionCycleStepState(
  stepIndex: number,
  activeStep: number,
  status: ProtectionCycleStatus
): ProtectionCycleStepState {
  if (status === "complete") return "complete";
  if (stepIndex < activeStep) return "complete";
  if (stepIndex === activeStep && status !== "idle" && status !== "error") return "active";
  return "waiting";
}

export function protectionCycleProgress(activeStep: number, status: ProtectionCycleStatus): number {
  if (status === "complete") return 100;
  if (status === "idle" || status === "error") return 0;
  return Math.max(0, Math.min(100, ((activeStep + 1) / PROTECTION_CYCLE_STEP_COUNT) * 100));
}
