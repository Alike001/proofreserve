import {ModelCandidate, PortfolioFeatures, REASON_CODES, REGIMES} from "./domain.js";
import {isReasonCode} from "./policy.js";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["regime", "confidenceBps", "reasonCodes", "rationale"],
  properties: {
    regime: {type: "string", enum: REGIMES},
    confidenceBps: {type: "integer", minimum: 0, maximum: 10_000},
    reasonCodes: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {type: "string", enum: REASON_CODES}
    },
    rationale: {type: "string", minLength: 1, maxLength: 500}
  }
} as const;

export class OllamaClient {
  constructor(
    private readonly model: string,
    private readonly baseUrl = "http://127.0.0.1:11434",
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async assess(features: PortfolioFeatures): Promise<ModelCandidate> {
    const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: RESPONSE_SCHEMA,
        options: {temperature: 0},
        messages: [
          {
            role: "system",
            content:
              "You are a conservative portfolio risk classifier. Use only the supplied typed facts. Identify interactions among repayment behavior, correlated group deterioration, loss, concentration, and utilization. Return only schema-valid JSON."
          },
          {role: "user", content: JSON.stringify(features)}
        ]
      })
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);

    const body = (await response.json()) as {message?: {content?: string}};
    if (!body.message?.content) throw new Error("Ollama response did not contain message content");
    return validateCandidate(JSON.parse(body.message.content) as unknown);
  }
}

export function validateCandidate(value: unknown): ModelCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("model output must be an object");
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  const expectedKeys = ["confidenceBps", "rationale", "reasonCodes", "regime"].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error("model output has unexpected fields");
  if (typeof candidate.regime !== "string" || !(REGIMES as readonly string[]).includes(candidate.regime)) {
    throw new Error("model output has invalid regime");
  }
  if (!Number.isInteger(candidate.confidenceBps) || Number(candidate.confidenceBps) < 0 || Number(candidate.confidenceBps) > 10_000) {
    throw new Error("model output has invalid confidence");
  }
  if (!Array.isArray(candidate.reasonCodes) || candidate.reasonCodes.length === 0) {
    throw new Error("model output must include reason codes");
  }
  const reasonCodes = candidate.reasonCodes.map((reason) => {
    if (typeof reason !== "string" || !isReasonCode(reason)) throw new Error("model output has invalid reason code");
    return reason;
  });
  if (new Set(reasonCodes).size !== reasonCodes.length) throw new Error("model reason codes must be unique");
  if (typeof candidate.rationale !== "string" || candidate.rationale.length < 1 || candidate.rationale.length > 500) {
    throw new Error("model output has invalid rationale");
  }

  return {
    regime: candidate.regime as ModelCandidate["regime"],
    confidenceBps: Number(candidate.confidenceBps),
    reasonCodes,
    rationale: candidate.rationale
  };
}
