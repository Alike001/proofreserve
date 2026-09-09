# ProofReserve

> Protected lending pools powered by verified cross-chain risk.

ProofReserve is a Creditcoin DeFi application for operating lending pools that protect liquidity before borrower problems spread. It turns Attestcoin-verified borrower events from other chains into an AI-recommended safety reserve that Creditcoin contracts enforce.

A pool with 100 test tokens may normally protect 10 and lend 90. When several related borrowers become late on Ethereum Sepolia, Attestcoin proves those events, Gemini identifies the portfolio pattern, and the Creditcoin controller can protect 40 instead. The AI cannot move funds or override contract policy.

## Status

Six local slices are implemented: an original source loan book and Attestcoin-compatible evidence receiver, a durable proof queue, a bounded reserve controller and capacity-enforcing pool, a Gemini-backed risk engine with a deterministic safety floor, an evidence-to-reserve agent that reconstructs features from Creditcoin before submitting, repeatable deployment/demo operations, and a responsive judge-facing dashboard. A live schema-bound Gemini inference was verified on 2026-09-09; public testnet deployments are not yet claimed.

## Demonstration flow

1. Fund a 100 prUSD pool on Creditcoin.
2. Record four healthy payments and two related late payments on Sepolia.
3. Let Attestcoin prove each fact and its checkpoint into Creditcoin.
4. Let Gemini explain the combined risk pattern within a closed schema.
5. Submit the assessment so the controller raises the protected reserve from 10% to 40%.
6. Compare `pnpm capacity:check before` and `pnpm capacity:check after` to show the pool itself allowing and then blocking the same 70 prUSD request without mutating demo state.

In one sentence: **ProofReserve notices verified trouble elsewhere and makes a Creditcoin lending pool keep more cash safe.**

See [the deployment and demo runbook](docs/deployment.md) for guarded commands and required testnet configuration.

## Why Attestcoin is essential

A Creditcoin contract cannot independently know whether a borrower paid late on Sepolia. A normal web API could report that event, but the pool would have to trust the API operator. Attestcoin supplies cryptographic proof that the source transaction belongs to the attested chain history. ProofReserve then validates the exact loan-book emitter, event type, borrower, group, sequence, epoch, and replay state before the fact may influence the pool.

Without Attestcoin, ProofReserve would be a lending pool trusting a centralized risk-data service. With Attestcoin, the evidence behind a reserve decision can be verified from public chain data.

## Product boundary

The hackathon MVP operates one fully verifiable protected pool. Repeatable self-service creation of additional pools is a product roadmap step and will not be presented as shipped unless its factory and onboarding path are deployed and tested.

`prUSD` is a test asset used to make the financial consequence visible. ProofReserve does not issue a production stablecoin and is not a generic token-creation platform.

## Product dashboard

Run the responsive dashboard locally:

    pnpm app:dev

It opens in a truthfully labeled preview state until the public `VITE_CREDITCOIN_RPC_URL`, evidence, controller, and pool addresses are configured. Browser variables are public by definition: never place the Gemini key or a wallet private key behind a `VITE_` prefix.

Create the production bundle with:

    pnpm app:build

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
- [Testnet deployment guide](./docs/deployment.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)

Keep the Gemini key in the server-side environment only. Free-tier prompts may be used by Google to improve its products, so ProofReserve sends only public testnet aggregate features and no personal borrower data. Testnet deployments separately need a wallet that can sign transactions and faucet funds for Sepolia and CC3 gas; neither secret should ever be committed or pasted into an issue or chat.

## Security notice

This is hackathon-stage testnet software. It is not audited and must not hold production funds.
