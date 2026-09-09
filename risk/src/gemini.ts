import {GoogleGenAI} from "@google/genai";

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
      items: {type: "string", enum: REASON_CODES}
    },
    rationale: {type: "string"}
  }
} as const;

export interface GeminiInteractionRequest {
  model: string;
  input: string;
  system_instruction: string;
  response_format: {
    type: "text";
    mime_type: "application/json";
    schema: typeof RESPONSE_SCHEMA;
  };
  store: false;
}

export type RunGeminiInteraction = (
  request: GeminiInteractionRequest
) => PromiseLike<{output_text?: string}>;

export class GeminiClient {
  private readonly runInteraction: RunGeminiInteraction;

  constructor(
    apiKey: string | undefined,
    private readonly model = "gemini-3.8-flash",
    runInteraction?: RunGeminiInteraction
  ) {
    if (runInteraction) {
      this.runInteraction = runInteraction;
      return;
    }

    this.runInteraction = async (request) => {
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
      const client = new GoogleGenAI({apiKey});
      const interaction = await client.interactions.create(request, {timeout: 20_000, maxRetries: 1});
      return interaction.output_text ? {output_text: interaction.output_text} : {};
    };
  }

  async assess(features: PortfolioFeatures): Promise<ModelCandidate> {
    const interaction = await this.runInteraction({
      model: this.model,
      store: false,
      system_instruction:
        "You are a conservative portfolio risk classifier. Use only the supplied typed facts. Identify interactions among repayment behavior, correlated group deterioration, loss, concentration, and utilization. Return only schema-valid JSON.",
      input: JSON.stringify(features),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: RESPONSE_SCHEMA
      }
    });

    if (!interaction.output_text) throw new Error("Gemini response did not contain output text");
    return validateCandidate(JSON.parse(interaction.output_text) as unknown);
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
