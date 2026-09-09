# Build Slice 03: Local Risk Engine

## Outcome

Typed portfolio features become a contract-compatible assessment without relying on a paid AI API or giving a model financial authority.

## Decision design

The risk engine has two layers:

1. a deterministic safety baseline catches explicit loss, correlated lateness, low evidence, and high utilization; and
2. a small Ollama model may confirm that regime or raise it after reasoning about interactions such as concentration plus payment volatility near high utilization.

The model can never lower the deterministic baseline. If Ollama is absent, times out, returns malformed JSON, uses an unknown reason code, or has confidence below policy, the baseline becomes the final assessment.

## Closed model output

Ollama receives a JSON Schema and may return only:

```text
regime
confidenceBps
reasonCodes
rationale
```

The application—not the model—maps the regime to reserve basis points and computes the evidence-root binding, feature hash, model/policy version hashes, reason-code hash, and Solidity-compatible decision hash.

## Free local path

The client targets Ollama at `http://127.0.0.1:11434`. The initial low-resource model choice is `qwen2.5:1.5b-instruct-q4_K_M`, subject to an actual latency and schema-reliability benchmark on the development machine.

No hosted AI key is needed. A blockchain signing key and faucet gas are still required later to submit assessments and deploy contracts; those are unrelated to AI billing.

## Current gate

The engine, safety behavior, hashes, and fallback are covered by tests. Ollama is not installed on the current machine, so a genuine local-model inference and benchmark remain open and are not represented as complete.
