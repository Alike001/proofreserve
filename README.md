# ProofReserve

> Protect a lending pool before defaults spread.

ProofReserve turns Attestcoin-verified borrower events from other chains into an AI-recommended safety reserve that Creditcoin contracts enforce.

A pool with 100 test tokens may normally protect 10 and lend 90. When several related borrowers become late on Ethereum Sepolia, Attestcoin proves those events, a local AI identifies the portfolio pattern, and the Creditcoin controller can protect 40 instead. The AI cannot move funds or override contract policy.

## Status

The product specification and first local vertical slice are complete: an original source loan book, an Attestcoin-compatible Creditcoin evidence receiver, and a durable proof queue. Testnet deployments are not yet claimed.

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

Current local verification: 16 Solidity tests pass and the TypeScript worker passes strict type-checking.

No paid AI API will be required. The default risk model will run locally through Ollama.

## Documentation

- [MVP product specification](./docs/product-spec.md)
- [Build slice](./docs/build-slice-01.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)

The no-paid-API promise applies to AI inference. Testnet deployments still need a wallet that can sign transactions and faucet funds for Sepolia and CC3 gas; no private key should ever be committed or pasted into an issue or chat.

## Security notice

This is hackathon-stage testnet software. It is not audited and must not hold production funds.
