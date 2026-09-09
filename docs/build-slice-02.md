# Build Slice 02: Reserve Enforcement

## Outcome

A schema-bound assessment can change a Creditcoin pool's actual lending capacity without granting the AI custody or arbitrary contract authority.

## Contracts

### `ReserveController`

The controller accepts assessments only from a restricted agent address and binds each decision to:

- a finalized evidence checkpoint and monotonic epoch;
- one of four finite reserve bands;
- a minimum confidence;
- the configured model and policy versions;
- a feature hash and reason-code hash; and
- a unique recomputed decision hash.

Reserve increases apply immediately. Decreases are scheduled, delayed, rechecked against evidence, and confirmed by the owner. Old evidence, replayed decisions, arbitrary percentages, wrong versions, and unknown roots revert.

### `ProofReservePool`

The pool holds a standard test ERC-20, accepts deposits, records loan commitments and principal, and derives capacity from live controller state:

```text
managed assets = liquid assets + outstanding principal
locked reserve = managed assets * active reserve bps / 10000
lendable = max(liquid assets - locked reserve - commitments, 0)
```

Counting outstanding principal in managed assets keeps the protected amount stable when an already committed loan is drawn.

## Proven scenario

With 100 test tokens:

- `NORMAL` at 10% protects 10 and leaves 90 lendable;
- a 70-token commitment succeeds;
- `STRESS` at 40% protects 40 and leaves 60 lendable; and
- the same 70-token commitment reverts.

The test suite also proves that the agent cannot call owner-only pool functions, withdrawals cannot consume reserved/committed liquidity, draws preserve managed assets, repayments restore liquidity, decreases cannot bypass the delay, and an older checkpoint cannot roll policy backward.
