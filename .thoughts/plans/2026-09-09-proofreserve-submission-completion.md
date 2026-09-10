# Plan: ProofReserve Hackathon Submission Completion

## Progress — 2026-09-10

- Phase 1, product claim: complete.
- Phase 2, public Sepolia/CC3 deployment: complete.
- Phase 3, seven-proof Attestcoin path: complete.
- Phase 4, reviewed Gemini artifact and Creditcoin enforcement: complete.
- Phase 5, live dashboard connection and final browser QA: complete.
- Phase 6, self-service pool creation: deferred until the judged path and submission assets are finished.
- Phase 7, submission package: in progress — public repository, hosted dashboard, production screenshots, DoraHacks copy, logo, and pitch-deck PDF complete; demo video and participant-supplied team fields remain.

## Inputs

- Hackathon requirement: every submission must use Attestcoin as a meaningful, functional core feature and run on a testnet.
- Accepted product thesis: Attestcoin supplies proven cross-chain repayment facts, Gemini interprets interacting portfolio risk, and Creditcoin contracts enforce a bounded reserve decision.
- Accepted positioning: ProofReserve is a DeFi application for operating protected lending pools. AI is an important internal capability, not the final authority.
- Existing specification: `docs/product-spec.md`.
- Existing implementation records: `docs/build-slice-01.md` through `docs/build-slice-06.md`.
- Existing deployment guide: `docs/deployment.md`.
- Existing code: Sepolia source loan book, Creditcoin evidence registry/controller/pool/test asset, Attestcoin worker, Gemini risk agent, deployment/demo scripts, and responsive dashboard.
- Existing local verification: 25 Solidity tests, 16 risk tests, one worker durability test, strict TypeScript checks, and a production dashboard build.
- Existing prototype: accepted desktop/mobile concepts and implemented browser renders under `design/`.

## Assumptions

- The submission will enter the **DeFi** track. AI will be described as the bounded risk-analysis engine inside the DeFi product.
- The judged MVP will demonstrate one fully operational pool. “A platform where anyone can create a protected pool” is the product direction, but will not be claimed as shipped unless a real factory/onboarding path is completed.
- The demo asset `prUSD` is a test token only. It will not be described as a production stablecoin.
- Stablecoin issuance, generic token creation, bridging, mainnet funds, KYC, and consumer-credit decisions are out of scope.
- Preview fixtures remain available for local development, but no screenshot, narration, or submission claim will present preview data as a public testnet result.
- The user will provide dedicated faucet-funded Sepolia and Creditcoin CC3 accounts through the ignored local `.env`; secrets will not be placed in chat, Git, frontend variables, or submission material.

## Open Questions

- Which public RPC endpoints and dedicated testnet accounts will be used for Sepolia and CC3?
- Which public GitHub repository URL and frontend hosting URL will be used?
- Does the selected Creditcoin explorer support source-code verification for these contracts, or should reproducible bytecode plus deployment manifests be the verification artifact?
- What personal/team information should appear in the DoraHacks registration and final submission?
- After the mandatory path passes, is there enough time for a real pool factory/onboarding flow? Until then it remains an explicitly deferred roadmap item.

## Prototype Reintegration Gate

The current dashboard has already been implemented from the accepted desktop and mobile concepts and browser-tested at 1536×1024 and 430×932. There is no separate prototype reintegration report, so this plan does not authorize a broad UI redesign.

The permitted UI work is narrowly scoped to replacing preview values with real CC3 state, adding public transaction/explorer links, removing any misleading preview presentation from the judged deployment, and fixing defects found during end-to-end verification.

No-shipping-mock decision:

- Local preview mode: allowed and visibly labeled.
- Judged public path: real Sepolia transactions, real Attestcoin proofs, real CC3 state, and a real Gemini request are required.
- Deck/video: may explain the architecture with diagrams, but the claimed result must be backed by public transaction hashes and addresses.

## Phase 1: Freeze the Product Claim

### Goal

Make every public description tell one consistent story within 30 seconds.

### Work

- Position ProofReserve as a protected lending-pool application, not a stablecoin or generic token factory.
- Keep the concrete 100 prUSD scenario: reserve changes from 10 to 40 and lendable capacity changes from 90 to 60.
- State that the current MVP operates one real pool; describe self-service pool creation only as the next product step unless implemented.
- Add an explicit “Why Attestcoin is essential” explanation to the README and submission copy.
- Keep the trust boundary visible: Attestcoin proves, Gemini recommends, Creditcoin enforces.

### Real Integration Path

All descriptions trace to implemented contract calls and the planned public transaction trail.

### Mock/Simulation Policy

No mock-specific value may appear as if it came from CC3.

### Checks

- A nontechnical reader can repeat the problem, input, decision, and financial consequence after reading the first screen.
- README, dashboard, deck, and video use the same numbers and terminology.

### Acceptance Criteria Covered

- Clear project description.
- Meaningful Attestcoin integration summary.
- Creditcoin ecosystem relevance.

### Stop Condition

Stop adding product concepts when the one-sentence pitch and golden scenario are consistent everywhere.

## Phase 2: Deploy the Real Testnet Foundation

### Goal

Create public Sepolia and Creditcoin CC3 deployments with reproducible manifests.

### Work

- Configure browser-safe RPC values separately from server-side signing credentials.
- Run `pnpm check` before deployment.
- Deploy `SourceLoanBook` to Sepolia using `pnpm deploy:source`.
- Deploy `ProofReserveEvidence`, `ReserveController`, `TestAsset`, and `ProofReservePool` to CC3 using `pnpm deploy:creditcoin`.
- Record chain IDs, addresses, deployer roles, block numbers, bytecode/configuration hashes, and transaction hashes.
- Register three demo borrowers and fund the pool with 100 prUSD using `pnpm setup:testnet`.
- Rerun setup to prove idempotency.

### Real Integration Path

Only public Sepolia and CC3 RPCs are used. The CC3 evidence contract uses the native Attestcoin verifier at `0x0000000000000000000000000000000000000FD2`.

### Mock/Simulation Policy

Local Anvil remains a regression fixture only. It cannot satisfy this phase.

### Checks

- Every manifest transaction has a successful public receipt on the intended chain.
- Deployed bytecode exists at every recorded address.
- Owner, worker, and risk-agent roles match the intended dedicated accounts.
- Pool balance and initial reserve/lendable values equal 100/10/90 prUSD.

### Acceptance Criteria Covered

- Testnet deployment.
- Working Creditcoin contracts.
- Reproducible setup documentation.

### Stop Condition

Do not publish source risk events until both deployment manifests and initial pool state independently reconcile.

## Phase 3: Prove the Attestcoin Path End to End

### Goal

Turn genuine Sepolia borrower events into typed, replay-protected facts on CC3.

### Work

- Run `pnpm scenario:stress` to create four on-time and two correlated late-payment facts plus checkpoint 1.
- Enqueue the seven source transaction hashes in order.
- Run the Attestcoin worker until every proof is accepted or a specific retryable/permanent failure is recorded.
- Capture the source transaction, proof query identity, CC3 acceptance transaction, typed fact, rolling root, and checkpoint root for each event.
- Attempt one duplicate submission in a controlled check and confirm replay rejection.

### Real Integration Path

The worker uses `@gluwa/usc-sdk` against the configured Attestcoin environment and submits the proof through the real CC3 verifier path.

### Mock/Simulation Policy

Verifier mocks are permitted only in Solidity unit tests. They are forbidden from the judged trace.

### Checks

- Six source facts and one checkpoint are accepted on CC3.
- Counts, values, sequence, portfolio, emitter, epoch, and final rolling root match the Sepolia scenario manifest.
- Restarting the worker does not duplicate accepted facts.

### Acceptance Criteria Covered

- Working Attestcoin Protocol integration code.
- Depth of Attestcoin utilization.
- Verifiable cross-chain data provenance.

### Stop Condition

Do not submit an AI decision until the complete evidence epoch reconciles on-chain.

## Phase 4: Demonstrate AI Reasoning and Contract Enforcement

### Goal

Show that several proven facts produce a bounded risk decision with a real financial consequence.

### Work

- Capture the normal-state reserve and 90 prUSD lending capacity before stress.
- Use `pnpm risk:preview` to reconstruct features from canonical CC3 state and obtain a live schema-bound Gemini assessment.
- Verify the deterministic floor, model/policy versions, feature hash, evidence root, confidence, reason codes, and proposed regime.
- Use `pnpm risk:submit` from the restricted agent account.
- Capture the controller event and resulting 40 prUSD reserve/60 prUSD lendable state.
- Add a repeatable read-only demo check proving that a 70 prUSD request fits before stress and fails after stress without corrupting the canonical demo state.
- Demonstrate at least one rejected invalid assessment or unauthorized action to make the contract authority visible.

### Real Integration Path

Features come only from accepted CC3 evidence and pool state. Gemini is called server-side. The controller independently constrains and applies the result.

### Mock/Simulation Policy

The deterministic fallback remains a safety feature, but the recorded AI demonstration must show a real Gemini response. A fixture-only assessment cannot satisfy this phase.

### Checks

- AI output conforms to the closed schema.
- AI never selects a reserve percentage directly and never signs pool transfers.
- The assessment transaction binds to the correct evidence root and feature/model/policy hashes.
- The visible pool capacity changes from 90 to 60 prUSD.
- A 70 prUSD request is demonstrably acceptable before and rejected after the reserve change.

### Acceptance Criteria Covered

- Functional AI integration.
- Smart-contract final authority.
- Practical DeFi impact rather than an informational dashboard.

### Stop Condition

Do not move to submission production until an independent observer can reproduce the evidence-to-enforcement chain from public data.

## Phase 5: Connect and Harden the Product Surface

### Goal

Make the existing dashboard a truthful public interface to the deployed product.

### Work

- Configure live CC3 RPC and deployed addresses in browser-safe build variables.
- Show current evidence count/root, AI assessment, controller regime, reserve, lendable capacity, and latest enforcement transaction.
- Add explorer links for Sepolia facts and CC3 proof/decision transactions.
- Ensure the judged URL starts in live mode or clearly reports a connection/configuration failure; it must not silently fall back to preview claims.
- Preserve server-side handling for Gemini and all private keys.
- Run responsive, interaction, accessibility, console, and empty/error-state checks.

### Real Integration Path

The frontend reads public CC3 state directly. Sensitive writes remain in the server-side worker/agent commands for the MVP.

### Mock/Simulation Policy

Preview mode may remain in source for local explanation but must be unmistakably labeled and excluded from the primary judged URL.

### Checks

- Desktop and mobile show identical canonical decision values.
- “Verify latest decision” reconciles live facts, root, decision, and enforcement.
- No secrets appear in the frontend bundle or network requests.
- No console errors, horizontal overflow, dead explorer links, or unlabeled placeholders.

### Acceptance Criteria Covered

- Understandable application rather than a contract-only demo.
- Public verification experience.
- Safe AI/API-key architecture.

### Stop Condition

The live product must explain and verify the complete result without requiring a judge to run the repository locally.

## Phase 6: Optional Pool-Creation Platform Layer

### Goal

Earn the stronger “Shopify for protected credit pools” claim without endangering the mandatory submission path.

### Work

- Design a tightly bounded `ProofReserveFactory` or scripted onboarding path for a manager to create another pool/controller pair with approved parameters.
- Reuse the existing evidence registry where safe; do not duplicate Attestcoin verification unnecessarily.
- Restrict deployable reserve bands, model/policy versions, asset configuration, and administrative roles.
- Add a small creation/onboarding interface and pool selector only if the contract path is real and tested.
- Ensure a newly created pool can be inspected by the same dashboard.

### Real Integration Path

Any claimed creation flow must execute on CC3 and result in publicly inspectable contracts and configuration.

### Mock/Simulation Policy

A nonfunctional “Create Pool” button is forbidden. If this phase does not complete, show the feature only in the roadmap/deck and keep the MVP claim to one operational pool.

### Checks

- Factory/configuration tests cover ownership, duplicate/configuration rejection, allowed assets, and role separation.
- One second pool can be created and discovered without modifying source code.
- `pnpm check` remains green.

### Acceptance Criteria Covered

- Product extensibility and CEIP investment narrative.
- Repeatable ecosystem growth path.

### Stop Condition

Stop immediately if this phase destabilizes the proven Attestcoin path, contract security boundary, or submission assets.

## Phase 7: Package the Submission

### Goal

Turn the verified product into a complete, judge-friendly DoraHacks entry.

### Work

- Publish the GitHub repository with an accurate README, architecture, setup, test, deployment, security, and Attestcoin integration documentation.
- Add the public deployment manifest and a concise transaction/proof index.
- Produce the project description and Attestcoin integration summary.
- Produce a short deck/whitepaper PDF covering problem, product, architecture, trust boundary, market, roadmap, and team.
- Record a 60–90 second primary demo and a longer technical walkthrough if useful.
- Complete team information and eligibility declarations truthfully.
- Check dependency licenses and retain `THIRD_PARTY_NOTICES.md`.

### Real Integration Path

Every material claim links to code, public testnet state, or a clearly labeled roadmap item.

### Mock/Simulation Policy

No fabricated users, traction, partnerships, audit status, mainnet readiness, or production stablecoin claims.

### Checks

- README contains exact reproduction commands.
- All public URLs work in a logged-out browser.
- Video audio/text is legible and shows the real transaction trail.
- Submission includes every organizer-required project and team field.

### Acceptance Criteria Covered

- GitHub repository with README.
- Technical Attestcoin documentation.
- Deck/whitepaper PDF.
- Prototype demo video.
- Complete project/team metadata.
- Third-party IP compliance.

### Stop Condition

The entry is not ready until the final compliance matrix has no unsupported “complete” status.

## Verification Checkpoint

Run a separate verification audit before submission:

1. Execute `pnpm check` from a clean checkout.
2. Reproduce the documented public testnet reads without privileged keys.
3. Trace at least one Sepolia transaction through Attestcoin proof acceptance, typed evidence, Gemini features, controller decision, and changed lending capacity.
4. Confirm worker restart/replay safety.
5. Confirm the judged dashboard never confuses preview data with live state.
6. Scan Git history and the production frontend bundle for secrets.
7. Compare README, deck, video, DoraHacks copy, deployed addresses, and transaction hashes for consistency.
8. Verify that stablecoin/token-factory language appears only as an explicitly deferred possibility, not as a shipped feature.

## Handoff Notes

- Immediate critical path: Phase 1 claim freeze, Phase 2 public deployments, Phase 3 genuine Attestcoin proofs, and Phase 4 enforcement.
- Phase 5 makes the working protocol legible to judges and should follow as soon as public addresses exist.
- Phase 6 is optional. It must never delay or weaken the real proof-to-enforcement demonstration.
- Phase 7 can be drafted in parallel with testnet waiting periods, but final claims and screenshots must use verified public results.
- Top-three placement and the grand prize cannot be guaranteed. The controllable winning factors are a memorable problem, indispensable Attestcoin usage, visible financial consequence, security boundaries, reproducibility, and polished communication.
