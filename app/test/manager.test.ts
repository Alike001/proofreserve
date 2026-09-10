import assert from "node:assert/strict";
import test from "node:test";

import {DEFAULT_MANAGER_BORROWER, managerErrorMessage, parseManagerRequest} from "../src/manager.js";

test("normalizes a valid manager commitment without losing token precision", () => {
  const request = parseManagerRequest(DEFAULT_MANAGER_BORROWER, "12.34567890123456789");
  assert.equal(request.borrower, DEFAULT_MANAGER_BORROWER);
  assert.equal(request.amount, 12_345_678_901_234_567_890n);
});

test("rejects zero and malformed borrower addresses", () => {
  assert.throws(() => parseManagerRequest("0x0000000000000000000000000000000000000000", "1"), /non-zero borrower/);
  assert.throws(() => parseManagerRequest("not-an-address", "1"), /non-zero borrower/);
});

test("rejects zero, signed, and over-precision amounts", () => {
  assert.throws(() => parseManagerRequest(DEFAULT_MANAGER_BORROWER, "0"), /greater than zero/);
  assert.throws(() => parseManagerRequest(DEFAULT_MANAGER_BORROWER, "-1"), /positive prUSD amount/);
  assert.throws(() => parseManagerRequest(DEFAULT_MANAGER_BORROWER, "1.0000000000000000001"), /18 decimals/);
});

test("turns a declined wallet request into a clear product message", () => {
  assert.equal(managerErrorMessage({code: 4001}), "The wallet request was declined.");
});
