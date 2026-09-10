# Reality Research: Is ProofReserve a testable product?

_Research date: 2026-09-10. This is a current-state audit and recommendation, not a prediction of hackathon placement._

> Historical note: this audit captured the product before the Liquidity Gate redesign. Its recommended landing page, application shell, and live no-key capacity test have since been implemented. See `2026-09-10-proofreserve-vs-resyvr.md` for the post-redesign comparison.

## Scope

This audit asks four questions:

1. What does ProofReserve actually do today?
2. What can a judge or user genuinely test?
3. How does it compare with real DeFi risk-control products and public BUIDL CTC 2026 Fall projects?
4. Should the team keep the idea, productize it, or restart with a different idea?

## Sources Checked

- ProofReserve application, contracts, workers, risk engine, tests, deployment manifests, and public CC3/Sepolia evidence.
- The current official [`gluwa/attestcoin-protocol-examples`](https://github.com/gluwa/attestcoin-protocol-examples) repository, including its proof-builder and loan flows.
- Public BUIDL CTC 2026 Fall repositories and live applications: [Spark](https://github.com/thesithunyein/spark), [CrossCredit](https://github.com/OoJae/crosscredit), [index41](https://github.com/edycutjong/index41), [Recourse](https://github.com/Ridwannurudeen/recourse), [AttestDesk](https://github.com/Qidianyan/attestdesk), [AttestFlow](https://github.com/0xConsole/attestflow), and [Aegis](https://github.com/Mujeebbot/Aegis).
- Established protocol patterns: [Aave Stewards](https://github.com/bgd-labs/aave-stewards), [Aera operations](https://docs.aera.finance/operations-and-submit), and [Morpho MetaMorpho](https://github.com/morpho-org/metamorpho).
- Live browser inspection of ProofReserve, Spark, CrossCredit, index41, and Recourse.
- A fresh `pnpm check` run on 2026-09-10.

## Verified Facts

### 1. The mechanism is real

ProofReserve is not a static mock. Its canonical path is:

1. `SourceLoanBook` on Sepolia records four settled payments and two late payments, then closes an epoch.
2. The worker uses `@gluwa/usc-sdk` to wait for attestation and obtain a proof for each source transaction.
3. `ProofReserveEvidence` on CC3 calls the native verifier at `0x0FD2`, decodes the verified receipt, and accepts only the configured source emitter, event type, borrower group, epoch, and checkpoint.
4. The risk engine builds typed features, calls Gemini, and maps the output to one of four reserve bands.
5. `ReserveController` checks the evidence root, epoch, confidence, model and policy versions, finite reserve band, signer, and replay state.
6. `ProofReservePool` uses the active reserve when calculating lendable assets.

The canonical public deployment contains seven successful Attestcoin proof acceptances and a CC3 reserve transaction. The pool moved from a 10% reserve and 90 prUSD lendable to a 40% reserve and 60 prUSD lendable. See [`docs/testnet-evidence.md`](../../docs/testnet-evidence.md).

### 2. The public frontend is a proof viewer, not an operating product

The browser reads `currentEpoch`, aggregate evidence counts, the evidence root, reserve state, pool assets, lendable assets, and the latest reserve event from CC3. Its only product action is to repeat those reads when the user clicks **Verify latest decision**. Evidence: [`app/src/App.tsx`](../../app/src/App.tsx) and [`app/src/data.ts`](../../app/src/data.ts).

The live page has:

- seven navigation or verification buttons;
- no form inputs;
- no wallet connection;
- no deposit, withdrawal, loan request, source event, proof submission, or risk-assessment action.

Therefore a visitor can verify that the recorded result exists, but cannot use the product's financial workflow.

### 3. The contracts expose more product behavior than the frontend uses

`ProofReservePool` implements deposits, withdrawals, owner-approved loan commitments, borrower draws, and principal repayments. The frontend currently calls only read methods. Evidence: [`contracts/src/creditcoin/ProofReservePool.sol`](../../contracts/src/creditcoin/ProofReservePool.sol).

A read-only CC3 experiment confirmed that a browser can already test arbitrary proposed loan amounts against the real contract without a wallet or state mutation:

| Proposed loan | Normal block 5,460,299 | Current STRESS state |
| --- | --- | --- |
| 50 prUSD | Allowed | Allowed |
| 70 prUSD | Allowed | Blocked |
| 95 prUSD | Blocked | Blocked |

These results came from `commitLoan.staticCall` using the actual pool owner as `from`, the deployed pool, the historical normal block, and the current chain state. This is an immediately available honest interactive product test; the current UI simply does not expose it.

### 4. Automated code tests are healthy but do not equal a user journey

The fresh `pnpm check` run passed:

- 25 Solidity tests;
- 16 risk-engine tests;
- one worker persistence test;
- strict TypeScript checks; and
- the production frontend build.

The tests establish useful safety properties: source-event semantics, emitter and group binding, replay rejection, sequential checkpoints, reserve bands, stale-epoch rejection, delayed reserve decreases, restricted agent authority, pool accounting, feature consistency, Gemini schema validation, safe fallback, and decision-hash parity.

Important boundaries:

- The Solidity evidence tests install a verifier whose `verifyAndEmit` always returns `true`; those tests validate ProofReserve's receipt interpretation, not Attestcoin's cryptography. The real precompile path is instead evidenced by the seven public CC3 transactions.
- The worker has one automated test covering durable/idempotent queue state. It does not have an automated end-to-end test of receipt detection, proof-builder output, and CC3 submission.
- Risk tests use controlled model doubles. The saved canonical artifact records one real Gemini run, but `pnpm check` does not call Gemini.
- There is no browser end-to-end test in the repository.
- There is no single no-key command that re-reads every live Sepolia and CC3 artifact and proves the complete deployed result.

### 5. Fresh end-to-end reproduction is developer-operated and expensive in attention

The deployment runbook requires multiple testnet signer roles, Sepolia ETH, CC3 CTC, a Gemini key for live inference, a fresh source epoch, manual scenario creation, seven enqueue/run operations, assessment review, and submission. The official Attestcoin examples also warn that a recent Sepolia block can take several minutes to become attested, with a twenty-minute wait ceiling in their helper.

This is a valid integration workflow, but it is not a three-minute judge test and is not exposed through the public application.

### 6. The original product acceptance gate is not currently met

The selected product scope says that:

- new source events should automatically enter the proof queue;
- assessments should recur by checkpoint;
- users should be able to deposit test assets and request a loan;
- the normal product interface should drive the workflow; and
- an independent reviewer should reproduce the sequence.

The shipped system instead uses manual CLI enqueue/run commands, a one-time canonical epoch, and a read-only frontend. The implementation is a strong deployed protocol prototype, but it does not yet satisfy its own definition of a finished product. Evidence: [`context/buidl-ctc-2026-fall/product-scope.md`](../../../context/buidl-ctc-2026-fall/product-scope.md).

### 7. The architecture has real-world precedent

The general architecture is commercially credible:

- Aave Steward contracts give a permissioned operator limited authority to adjust protocol parameters.
- Aera lets an off-chain guardian propose vault operations while on-chain hooks restrict what may execute.
- MetaMorpho separates depositors from risk managers and constrains allocations with roles, supply caps, and timelocks.

ProofReserve's distinct contribution is to make verified cross-chain borrower events an input to that type of bounded risk control on Creditcoin.

### 8. Current hackathon competition is stronger at the product surface

- Spark exposes a borrower journey: connect wallet, pay on Sepolia, prove payment and balance, unlock credit, view score, withdraw, and repay.
- CrossCredit imports real Aave/SparkLend history, produces an on-chain credit tier, and demonstrates an opened and repaid loan.
- Recourse exposes a full facility lifecycle and wallet-reviewed transactions.
- index41 is not a broad application, but it has an unusually concrete action: prove a real mainnet sandwich and pay the victim from a relay bond.
- ProofYield exposes token minting, deposits, proof harvesting, portfolio views, and allocation controls.

ProofReserve remains differentiated from the crowded borrower-score and single-loan underwriting category because it acts at the pool level. Its closest public neighbor, AttestFlow, describes a DeFi sentinel but discloses that its on-chain proof submission is mocked. That makes ProofReserve's real seven-proof path materially stronger than that particular neighbor.

### 9. The canonical AI result does not prove that AI was necessary

For the canonical six-fact scenario, `deterministicBaseline` already classifies two correlated late borrowers as `STRESS`. Gemini also returned `STRESS`. The AI adds rationale and confidence, but it did not change the financial outcome in the deployed demonstration.

The test suite contains a better counterexample: a deterministic `WATCH` baseline can be raised by Gemini to `STRESS` when lateness, concentration, and utilization interact. That scenario is tested locally but is not the public deployed product story.

This weakens an **AI-track** submission. It does not invalidate a **DeFi-track** product whose primary innovation is verified, contract-enforced risk control.

## Inferences

### Current verdict

The user's reaction is correct: **the current public experience is more documentation plus a live audit dashboard than a usable product**.

The underlying implementation is substantially stronger than the page suggests, but judges evaluate what they can understand and exercise. In its present form, ProofReserve is technically credible but not top-three ready as a product. No placement estimate can be made reliably because judging and unpublished submissions are unknown.

### Idea verdict

Do not discard the contracts or restart from zero. The pool-level risk-control idea remains less crowded than credit scoring, under-collateralized borrower underwriting, invoice finance, or liquidation monitoring. A total pivot would throw away the project's strongest evidence: seven real Attestcoin proofs, a bounded controller, and an actual lending-capacity consequence.

The right move is a **product pivot, not an idea pivot**:

> Turn ProofReserve from a landing page about a reserve controller into a pool-manager application where anyone can test the controller against real CC3 state and trace every input that caused the decision.

### Track verdict

Submit primarily to **DeFi**, not AI, unless a second live scenario demonstrates Gemini changing a decision that the disclosed deterministic baseline cannot make. DeFi better matches what is unquestionably real today: a lending pool's available capital is constrained by Attestcoin-verified external risk.

## Recommended Product Test

The minimum honest judge experience should require no wallet, key, faucet, or waiting:

1. Open the live pool console.
2. Enter any proposed loan amount, such as 70 prUSD.
3. Click **Test lending capacity**.
4. The app runs the real `commitLoan` call as an `eth_call` at the recorded NORMAL block and against current STRESS state.
5. It shows **Allowed before / Blocked now**, including the actual contract error and both block numbers.
6. The user opens the six source facts, seven Attestcoin acceptances, Gemini artifact, and CC3 enforcement transaction that explain the difference.

This would turn the current strongest claim into something the judge personally tests while preserving truth: no fake regime toggle and no browser-only state.

A repository-level `pnpm verify:live` command should perform the same no-key audit from a clean clone: validate all source receipts, all CC3 acceptance receipts, current evidence aggregates/root, decision transaction, current pool capacity, and historical/current loan simulations.

## Recommended Productization Scope

### Must do before reconsidering visual styling

1. Replace the explanation-heavy default view with an application shell: **Pool**, **Capacity Test**, **Evidence**, **Decision**, and **Integration**.
2. Add the real arbitrary-amount historical/current capacity test described above.
3. Add a fact-level explorer for all six source events and seven CC3 Attestcoin acceptances.
4. Show the exact model inputs, deterministic baseline, Gemini output, policy checks, and why the contract accepted the result.
5. Add `pnpm verify:live` and browser end-to-end coverage.
6. Either add source-log watching and automatic queueing or stop calling the worker autonomous/continuous.
7. Reduce the landing page to one short hero and one clear **Open live pool** action; move explanations into contextual help.

### Optional strengthening work

- Deploy a second ambiguous evidence epoch where Gemini raises a deterministic `WATCH` baseline to `STRESS`; use it only if targeting AI.
- Add a manager-authenticated path for deposits, withdrawals, and loan commitments.
- Add a deliberately valueless test-asset faucet only if public wallet interaction is worth the deployment and security surface.
- Package the controller as an integration adapter for other Creditcoin pools rather than claiming self-service pool creation before a factory exists.

## Unknowns And Questions

- The official scoring rubric beyond the published Attestcoin-depth statement is not public in the supplied hackathon material.
- The complete DoraHacks submission list is not reliably enumerable from the public page, so the competitor set is evidence-based but incomplete.
- No Creditcoin lending protocol or external pool manager has validated that a dynamic liquidity reserve is a priority problem for them.
- A second independent browser tester has not yet attempted the proposed capacity-test workflow.
- The current public pool is permanently in its demonstrated `STRESS` state unless a newer valid epoch schedules and completes a safer decrease.

## Decision

**Keep the core idea and deployed contracts. Do not submit the project in its current read-only form. Rebuild the product surface around a real, no-key capacity test and auditable evidence workflow, then reassess the UX.**

If that productization work is not going to be done, then a pivot is justified. A generic stablecoin/token factory is not the recommended pivot because Attestcoin would become incidental and the product would enter a more crowded, less defensible category.
