# Build Slice 04: Evidence-to-Reserve Agent

## Outcome

The risk agent can reconstruct an assessment from canonical Creditcoin state and submit it to `ReserveController`. The production path no longer accepts a hand-edited feature file.

## Feature provenance

For one finalized evidence epoch, the agent pins a Creditcoin block and reads:

- the checkpoint root and settled, late, and loss aggregates from `ProofReserveEvidence`;
- every accepted fact event from the evidence contract's deployment block through the pinned block;
- distinct deteriorating borrowers and their registered groups from those accepted events; and
- managed assets, commitments, and outstanding principal from `ProofReservePool`.

It rejects the assessment before calling Gemini when the event count, event values, final rolling root, epoch, or on-chain aggregates disagree. `groupConcentrationBps` means the share of distinct deteriorating borrowers found in the largest deteriorating group; it is not presented as global market exposure.

Pool utilization is derived as:

```text
(total commitments + principal outstanding) / total managed assets
```

## Commands

Preview the latest finalized checkpoint without signing a transaction:

```bash
pnpm risk:preview
```

Preview a particular epoch:

```bash
pnpm risk:preview 1
```

Submit the assessment with the restricted risk-agent signer:

```bash
pnpm risk:submit
```

The commands require the deployed contract addresses and `EVIDENCE_DEPLOYMENT_BLOCK`. Submission additionally requires `RISK_AGENT_PRIVATE_KEY`; this must be the address configured as `ReserveController.agent` and must not be the pool owner or a funded production wallet.

## Submission safeguards

Before sending, the client checks the configured agent address, monotonic epoch, model version, policy version, and decision replay state. It then simulates `submitAssessment`, estimates gas, sends only that contract method, waits for the configured confirmations, and requires a successful receipt.

The controller remains final authority: it recomputes the decision digest, checks the evidence checkpoint, restricts the reserve to its four bands, applies safer increases immediately, and delays decreases.

## Current gate

Feature derivation, reconciliation failures, Gemini structured output, fallback behavior, and the Solidity controller boundary are locally tested. A CC3 submission remains pending until the contracts and restricted agent are deployed on testnet.
