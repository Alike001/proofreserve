# Build Slice 01: Proven Fact Path

## Outcome

A real Sepolia lifecycle event can travel through the official Attestcoin proof path and become a typed, replay-protected fact on Creditcoin CC3 Testnet.

## Components

### `SourceLoanBook`

An Ethereum Sepolia evidence adapter. It registers borrowers, concentration groups, and obligations; authorized reporters record settlement, lateness, and realized loss; sequential checkpoints close observation epochs.

### `ProofReserveEvidence`

A Creditcoin Attestcoin Smart Contract. It invokes the official verifier through `ASCBase`, decodes only successful receipts, accepts only the configured Sepolia chain and source emitter, validates the exact event schema, and stores typed facts once.

### `fact-worker`

A durable TypeScript process. It observes the configured source, waits for Attestcoin attestation, obtains proofs with `@gluwa/usc-sdk`, submits them, and records processing state so restart does not duplicate facts.

## Data lifecycle

```text
Sepolia SourceLoanBook call
  -> purpose-specific event in successful receipt
  -> worker queues source transaction hash
  -> Attestcoin attests the source block
  -> @gluwa/usc-sdk retrieves proof
  -> ProofReserveEvidence.execute(...) on CC3
  -> verifier precompile validates inclusion and continuity
  -> contract validates emitter + event + portfolio + sequence + replay
  -> typed fact and evidence root become Creditcoin state
```

## Slice gates

1. Source lifecycle transitions and checkpoints pass local tests.
2. Evidence decoding and spoof/replay rejection pass local tests against a verifier mock.
3. Network preflight identifies one internally consistent proof-builder and decoder configuration.
4. A real Sepolia event is accepted on CC3.
5. The resulting fact can be queried using only its Creditcoin transaction and contract state.

## Failure behavior

- Unknown emitter or event: reject on-chain.
- Failed source receipt: reject on-chain.
- Duplicate fact: reject on-chain.
- Proof not ready: retain queued state and retry later.
- RPC/proof-builder timeout: bounded retry and visible failed/waiting state.
- Conflicting network configuration: stop before deployment and report the mismatch.
