import assert from "node:assert/strict";
import test from "node:test";

import {PROTECTION_CYCLE_STEP_COUNT, protectionCycleProgress, protectionCycleStepState} from "../src/protection-cycle.js";

test("keeps every replay stage waiting before the run starts", () => {
  for (let index = 0; index < PROTECTION_CYCLE_STEP_COUNT; index += 1) {
    assert.equal(protectionCycleStepState(index, -1, "idle"), "waiting");
  }
  assert.equal(protectionCycleProgress(-1, "idle"), 0);
});

test("marks earlier replay stages complete and the current stage active", () => {
  assert.equal(protectionCycleStepState(0, 2, "playing"), "complete");
  assert.equal(protectionCycleStepState(1, 2, "playing"), "complete");
  assert.equal(protectionCycleStepState(2, 2, "playing"), "active");
  assert.equal(protectionCycleStepState(3, 2, "playing"), "waiting");
  assert.equal(protectionCycleProgress(2, "playing"), 50);
});

test("marks every replay stage complete only after verification finishes", () => {
  for (let index = 0; index < PROTECTION_CYCLE_STEP_COUNT; index += 1) {
    assert.equal(protectionCycleStepState(index, 5, "complete"), "complete");
  }
  assert.equal(protectionCycleProgress(5, "complete"), 100);
});
