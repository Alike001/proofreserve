# Build Slice 03: Gemini Risk Engine

## Outcome

Typed portfolio features become a contract-compatible assessment through Gemini's free tier without giving a model financial authority.

## Decision design

The risk engine has two layers:

1. a deterministic safety baseline catches explicit loss, correlated lateness, low evidence, and high utilization; and
2. Gemini may confirm that regime or raise it after reasoning about interactions such as concentration plus payment volatility near high utilization.

The model can never lower the deterministic baseline. If the Gemini key is missing, the request times out, free quota is exhausted, output is malformed, a reason code is unknown, or confidence is below policy, the baseline becomes the final assessment.

## Closed model output

Gemini receives a JSON Schema and may return only:

```text
regime
confidenceBps
reasonCodes
rationale
```

The application—not the model—maps the regime to reserve basis points and computes the evidence-root binding, feature hash, model/policy version hashes, reason-code hash, and Solidity-compatible decision hash.

## Free-tier hosted path

The server-side client calls the official Gemini Interactions REST API with the key in the `x-goog-api-key` header. The default model is `gemini-3.7-flash`, selected because Google's current pricing page lists free input and output tokens for it and it responds faster for this bounded classification task. A `GEMINI_API_KEY` is required for live inference, but upgrading to a paid tier is not required within free-tier limits.

The key must stay in the worker environment and never enter the browser, repository, logs, or chat. Free-tier prompts may be used to improve Google's products, so the model receives only public testnet aggregates and identifiers—not personal or confidential borrower data.

A blockchain signing key and faucet gas are separately required later to submit assessments and deploy contracts; those credentials are unrelated to the Gemini key or AI billing.

## Current gate

The engine, schema request, safety behavior, hashes, missing-key behavior, and fallback are covered by tests. A genuine `gemini-3.7-flash` inference against the stress fixture succeeded on 2026-09-09 and returned a schema-valid `STRESS` assessment through the `GEMINI` path.
