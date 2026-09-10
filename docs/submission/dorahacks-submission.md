# ProofReserve — BUIDL CTC 2026 Fall submission draft

## Project information

### Project name

ProofReserve

### Sector

DeFi

### One-line summary

Protected lending pools powered by verified cross-chain risk.

### Project description

ProofReserve helps a Creditcoin lending pool protect liquidity before borrower problems spread across a portfolio.

In the live testnet scenario, a pool starts with 100 prUSD, protects 10%, and can lend 90. Four healthy payments and two late payments from related borrowers are recorded on Ethereum Sepolia. Attestcoin proves those source-chain transactions into Creditcoin. Gemini interprets the combined pattern as correlated stress, but it can select only a policy-approved risk regime. The Creditcoin controller retains final authority and raises the protected reserve to 40%. The same 70 prUSD loan request that previously fit is then rejected because only 60 remains lendable.

ProofReserve is a working DeFi product flow rather than an AI-controlled wallet or an oracle dashboard: verified external evidence changes an enforceable financial limit on Creditcoin.

### Attestcoin Protocol integration summary

Attestcoin is a core security dependency, not a decorative data feed. A Creditcoin contract cannot independently know whether a repayment event occurred on Sepolia. ProofReserve uses `@gluwa/usc-sdk` to request Attestcoin inclusion and continuity proofs for seven real Sepolia transactions. Those proofs are submitted to the native CC3 verifier and accepted only after `ProofReserveEvidence` validates the successful receipt, source chain, allowlisted loan-book emitter, exact event signature, portfolio, borrower, borrower group, sequence, epoch, and replay state.

Six typed repayment facts and one checkpoint are finalized on CC3. The checkpoint root commits the complete ordered portfolio view used by the risk engine. Gemini receives only the resulting public aggregates and recommends one of four bounded regimes. `ReserveController` verifies the evidence root, epoch, feature hash, model version, policy version, confidence floor, authorized signer, and permitted reserve band before changing the pool reserve. The AI cannot transfer funds, construct arbitrary calls, or choose an arbitrary reserve percentage.

Without Attestcoin, the pool would have to trust a centralized operator's report about another chain. With Attestcoin, judges can trace the financial decision from public Sepolia receipts to CC3 evidence and enforcement.

## Why it matters

Cross-chain credit systems often evaluate risk from isolated feeds or simplistic thresholds. That can miss a portfolio pattern: two late payments may be much more dangerous when both borrowers belong to the same economic group. ProofReserve combines verified cross-chain facts with bounded AI reasoning, then lets deterministic contracts control the money.

The product direction is reusable risk infrastructure for Creditcoin lending operators. New pools could configure their own source loan books and reserve policies while sharing the same Attestcoin-to-enforcement pipeline. The hackathon MVP truthfully demonstrates one deployed pool; self-service pool creation is roadmap work.

## What works today

- A deployed Sepolia loan book with real repayment events.
- Seven finalized Attestcoin proofs on Creditcoin CC3 Testnet.
- Typed, replay-protected Creditcoin evidence with sequential checkpoints.
- Gemini structured assessment recorded as a hash-validated artifact.
- Four contract-approved regimes: NORMAL, WATCH, STRESS, and CRISIS.
- A 100 prUSD test pool whose reserve changed from 10% to 40%.
- A contract-level capacity check showing 70 prUSD allowed before and rejected after.
- A public responsive dashboard that reads the live CC3 contracts.
- Restart/idempotence, policy-boundary, signature, freshness, replay, and reconciliation tests.

## Architecture

```text
Ethereum Sepolia SourceLoanBook
  -> Attestcoin inclusion + continuity proofs
  -> native CC3 verifier
  -> ProofReserveEvidence typed facts + checkpoint
  -> versioned portfolio feature builder
  -> Gemini structured regime recommendation
  -> ReserveController deterministic policy checks
  -> ProofReservePool enforceable lending capacity
  -> public live dashboard
```

## Trust boundary

- Attestcoin proves source-chain inclusion and continuity.
- ProofReserve validates the business meaning of the attested receipt.
- Gemini interprets aggregate patterns but can recommend only a finite regime.
- Creditcoin contracts enforce signatures, versions, confidence, freshness, evidence roots, reserve bands, and delayed decreases.
- Only the smart contracts affect pool capacity.

## Public links

- Repository: https://github.com/Alike001/proofreserve
- Live dashboard: https://proofreserve.vercel.app
- Testnet evidence index: https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md
- Canonical CC3 enforcement transaction: https://creditcoin-testnet.blockscout.com/tx/0x300b1ad4e7f51da215b0630f370a73bef030c0e8c1e26ed80192e2cd8da77126
- Pitch deck PDF: https://github.com/Alike001/proofreserve/raw/main/docs/pitch-deck.pdf
- Demo video: TODO — add public video URL after recording and upload.
- Project logo: https://raw.githubusercontent.com/Alike001/proofreserve/main/docs/assets/brand/proofreserve-logo.svg

## 90-second demo outline

1. **0:00–0:10 — Problem:** A Creditcoin pool cannot safely react to repayment trouble on another chain if it must trust a private API.
2. **0:10–0:25 — Normal state:** Show 100 prUSD managed, 10% protected, 90 lendable, and a 70 prUSD request allowed.
3. **0:25–0:43 — Proven facts:** Show four settled and two related late Sepolia payments, then the Attestcoin proof manifest and CC3 checkpoint.
4. **0:43–0:58 — Bounded AI:** Show Gemini selecting STRESS with 85% confidence because lateness is concentrated in one borrower group. Explain that AI cannot move money.
5. **0:58–1:15 — Enforcement:** Show the canonical CC3 transaction, 40% reserve, 60 lendable, and the same 70 prUSD request blocked by the contract.
6. **1:15–1:30 — Close:** “Attestcoin supplies proven facts, AI interprets them, and Creditcoin contracts retain final authority.”

## Reproduction and testing

```bash
git clone https://github.com/Alike001/proofreserve.git
cd proofreserve
pnpm install
pnpm check
pnpm app:dev
```

No wallet or paid AI key is required to inspect the public dashboard and committed evidence. Re-running the live worker or risk submission requires faucet-funded testnet wallets. A Gemini Developer API key is required only for a fresh live model assessment; the selected model supports free-tier use within Google's current quota.

## Known limitations

- Hackathon-stage testnet software; not audited and not suitable for production funds.
- The demo reporter is trusted to record its own loan lifecycle accurately; ProofReserve does not claim complete global borrower history.
- The MVP protects one configured test pool and uses `prUSD` only as a test token.
- Self-service multi-pool creation, mainnet deployment, governance, and production integrations are roadmap items.

## Organizer form checklist

### Ready

- Project name
- Sector
- Project description
- Attestcoin integration summary
- Public GitHub repository URL with README
- Public dashboard URL
- Pitch deck PDF URL
- Testnet deployment and transaction evidence

### Requires the participant

- Prototype demo video URL after recording/upload
- First and last name
- Email
- Telegram ID, if desired
- X/Twitter, if desired
- LinkedIn, if desired
- Resume PDF URL, if desired
- Truthful short bio
- Role within the team
- Country of residence
- Country of citizenship
- Eligibility confirmation under the organizer's rules

## Suggested registration text

### Short bio template

`[Name] is a [role/background] focused on building practical blockchain products. For ProofReserve, [he/she/they] designed and built the cross-chain evidence pipeline, bounded AI risk engine, Creditcoin contracts, and product dashboard.`

Replace every bracketed field with truthful personal information before submitting.

### Role within the team

Solo builder — product, smart contracts, Attestcoin integration, AI risk engine, frontend, testing, and deployment.
