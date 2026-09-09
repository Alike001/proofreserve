# ProofReserve

> Protect a lending pool before defaults spread.

ProofReserve turns Attestcoin-verified borrower events from other chains into an AI-recommended safety reserve that Creditcoin contracts enforce.

A pool with 100 test tokens may normally protect 10 and lend 90. When several related borrowers become late on Ethereum Sepolia, Attestcoin proves those events, Gemini identifies the portfolio pattern, and the Creditcoin controller can protect 40 instead. The AI cannot move funds or override contract policy.

## Status

Four local slices are implemented: an original source loan book and Attestcoin-compatible evidence receiver, a durable proof queue, a bounded reserve controller and capacity-enforcing pool, a Gemini-backed risk engine with a deterministic safety floor, and an evidence-to-reserve agent that reconstructs features from Creditcoin before submitting. A live schema-bound Gemini inference was verified on 2026-09-09; testnet deployments are not yet claimed.

## Trust boundary

- Attestcoin proves source-chain transaction inclusion and continuity.
- ProofReserve contracts validate the successful receipt, allowlisted emitter, exact event, subject, sequence, freshness, and replay state.
- AI recommends one finite policy regime.
- Creditcoin contracts retain final authority over the reserve and lending capacity.

## Development

Requirements: Node.js 22+, pnpm 10+, and Foundry.

```bash
pnpm install
pnpm check
```

Current local verification: 25 Solidity tests, one worker restart/idempotence test, and fourteen risk-engine tests pass; all TypeScript passes strict type-checking.

Live AI inference uses the Gemini Developer API and requires a server-side `GEMINI_API_KEY`. The selected model is available on Google's free tier, so a paid AI account is not required for the hackathon within current quotas. If the key, network, or quota is unavailable, the risk engine fails safely to its deterministic baseline; a live Gemini call is still required to demonstrate the AI integration.

Create a new auth key in [Google AI Studio](https://aistudio.google.com/app/apikey), copy `.env.example` to the ignored `.env` file, and place the key there locally. Load that environment only into the server-side worker before running `pnpm risk:assess risk/fixtures/stress-features.json`. Never put the key in frontend code or paste it into chat.

## Documentation

- [MVP product specification](./docs/product-spec.md)
- [Build slice](./docs/build-slice-01.md)
- [Reserve enforcement slice](./docs/build-slice-02.md)
- [Gemini risk engine slice](./docs/build-slice-03.md)
- [Evidence-to-reserve agent slice](./docs/build-slice-04.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)

Keep the Gemini key in the server-side environment only. Free-tier prompts may be used by Google to improve its products, so ProofReserve sends only public testnet aggregate features and no personal borrower data. Testnet deployments separately need a wallet that can sign transactions and faucet funds for Sepolia and CC3 gas; neither secret should ever be committed or pasted into an issue or chat.

## Security notice

This is hackathon-stage testnet software. It is not audited and must not hold production funds.
