import assert from "node:assert/strict";
import test from "node:test";

import {GeminiClient, validateCandidate} from "../src/gemini.js";
import {PortfolioFeatures} from "../src/domain.js";

const FEATURES: PortfolioFeatures = {
  schemaVersion: 1,
  epoch: 1,
  evidenceRoot: `0x${"22".repeat(32)}`,
  evidenceCount: 3,
  settledCount: 3,
  settledValue: "300",
  lateCount: 0,
  lateValue: "0",
  lossCount: 0,
  lossValue: "0",
  deterioratingBorrowers: 0,
  maxDeterioratingBorrowersInOneGroup: 0,
  groupConcentrationBps: 3_000,
  utilizationBps: 5_000,
  evidenceAgeSeconds: 60
};

test("strict candidate validation rejects additional fields", () => {
  assert.throws(
    () =>
      validateCandidate({
        regime: "NORMAL",
        confidenceBps: 9_000,
        reasonCodes: ["HEALTHY_REPAYMENT"],
        rationale: "Healthy.",
        transferTo: "0x000000000000000000000000000000000000dEaD"
      }),
    /unexpected fields/
  );
});

test("strict candidate validation rejects unknown reason codes", () => {
  assert.throws(
    () =>
      validateCandidate({
        regime: "STRESS",
        confidenceBps: 9_000,
        reasonCodes: ["SEND_FUNDS"],
        rationale: "Untrusted instruction."
      }),
    /invalid reason code/
  );
});

test("Gemini request carries a JSON schema and accepts structured output", async () => {
  let requestBody: Record<string, unknown> | undefined;
  let apiKeyHeader: string | null = null;
  const fetchMock: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    apiKeyHeader = new Headers(init?.headers).get("x-goog-api-key");
    return new Response(
      JSON.stringify({
        status: "completed",
        steps: [
          {type: "thought"},
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  regime: "WATCH",
                  confidenceBps: 8_000,
                  reasonCodes: ["HIGH_UTILIZATION"],
                  rationale: "Utilization is elevated."
                })
              }
            ]
          }
        ]
      }),
      {status: 200, headers: {"content-type": "application/json"}}
    );
  };

  const client = new GeminiClient("test-key", "test-model", fetchMock);
  const result = await client.assess(FEATURES);
  assert.equal(result.regime, "WATCH");
  assert.equal(requestBody?.model, "test-model");
  assert.equal(requestBody?.store, false);
  assert.equal(apiKeyHeader, "test-key");
  const responseFormat = requestBody?.response_format as Record<string, unknown>;
  assert.equal(responseFormat.mime_type, "application/json");
  const schema = responseFormat.schema as Record<string, unknown>;
  assert.equal(schema.additionalProperties, false);
});

test("Gemini client requires a server-side API key for live inference", async () => {
  const client = new GeminiClient(undefined);
  await assert.rejects(client.assess(FEATURES), /GEMINI_API_KEY/);
});
