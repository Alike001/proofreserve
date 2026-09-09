# Build Slice 05: Repeatable Demo Operations

## Outcome

A fresh deployment can be turned into the complete ProofReserve demonstration without hand-authoring borrower events or guessing transaction order.

## Setup

`pnpm setup:testnet` registers three borrowers with matching group identifiers in the Sepolia loan book and Creditcoin evidence registry, then funds the lending pool with 100 prUSD. The command validates both chain IDs and existing state. A matching rerun sends no transactions; conflicting borrower groups or pool balances stop the run.

## Stress scenario

`pnpm scenario:stress` produces one closed source epoch containing:

- four on-time payment facts;
- two late-payment facts;
- two distinct late borrowers that share one registered group; and
- a source checkpoint committing to all six facts.

The scenario manifest separates the seven transaction hashes Attestcoin must prove from the administrative obligation-opening transactions. It also records the source root, amounts, timestamps, and every transaction receipt reference required for judging and debugging.

## Why this is meaningful

A fixed rule can count late payments. ProofReserve instead exposes several verified dimensions—frequency, distinct borrowers, shared-group concentration, loss, evidence volume, and current pool utilization—to bounded AI reasoning. The output is still only a recommendation within four contract-approved reserve bands.

## Verification

The setup and scenario were exercised end to end on a disposable Anvil chain. The idempotency check produced zero transactions on its second setup run, and the scenario closed epoch 1 with six facts and emitted seven Attestcoin input transaction hashes.

Public Sepolia and Creditcoin deployment remains a separate gate and is not claimed by this local verification.
