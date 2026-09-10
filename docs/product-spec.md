# ProofReserve MVP Product Specification

## Objective

ProofReserve protects a Creditcoin lending pool before cross-chain borrower problems spread. Attestcoin supplies proven facts, Gemini interprets interacting portfolio signals, and Creditcoin contracts retain final authority over the financial consequence.

The product direction is a Creditcoin application through which lending operators can run protected pools under the same proof-to-enforcement model. The hackathon MVP proves that model with one complete pool; it does not depend on a token factory or stablecoin issuer.

## User and outcome

The primary user is a lending-pool manager or risk operator. They configure a pool and an allowlisted external loan book, then monitor how much liquidity is protected and how much remains lendable.

The clearest acceptance scenario is:

1. a Creditcoin pool holds 100 test tokens and protects 10;
2. a 70-token loan request fits within its 90-token normal capacity;
3. four small repayments settle while two much larger repayments become late across separate borrower groups on Sepolia;
4. Attestcoin proofs turn those receipts into typed Creditcoin facts;
5. count-only rules return `WATCH`, while Gemini recognizes that 500 late value overwhelms 40 settled value and recommends `STRESS`;
6. the controller protects 40 tokens; and
7. the same 70-token request now fails because only 60 remain lendable; and
8. an authorized manager can preflight, commit, and cancel an allowed loan-capacity reservation from the application.

## Required product loop

```text
Sepolia lifecycle event
  -> Attestcoin inclusion + continuity proof
  -> typed Creditcoin evidence
  -> versioned portfolio features
  -> Gemini regime recommendation
  -> deterministic policy checks
  -> locked reserve
  -> actual lending-capacity change
```

## Trust model

- Attestcoin proves that the supplied source transaction belongs to an attested chain history.
- `ProofReserveEvidence` additionally requires source chain key `1`, a successful receipt, the configured emitter, an exact purpose-specific event, the configured portfolio, a registered borrower/group, the current epoch, and an unused query identity.
- Sequential checkpoint roots prevent an operator from presenting a favourable checkpoint after omitting an already committed adverse fact from that configured loan book.
- The source reporter remains trusted to report the loan-book lifecycle accurately. ProofReserve does not claim complete global borrower history.
- AI proposes only one of four regimes. It cannot transfer tokens, construct arbitrary calls, choose arbitrary reserve values, or reduce the reserve without the controller's delay/confirmation rule.

## MVP requirements

- Ethereum Sepolia `SourceLoanBook` with three borrowers in two groups and at least six genuine lifecycle transactions.
- Creditcoin CC3 `ProofReserveEvidence` using the native verifier at `0x0000000000000000000000000000000000000FD2`.
- Durable worker queue using `@gluwa/usc-sdk` with retry and restart deduplication.
- Versioned feature builder and Gemini Developer API model with strict structured output.
- Four finite reserve regimes: `NORMAL`, `WATCH`, `STRESS`, and `CRISIS`.
- Reserve controller plus test-asset pool where reserve changes constrain actual loans.
- Manager console and public evidence-to-decision verification view.
- Owner-gated browser workflow for loan commitment preflight, confirmation, receipt inspection, and cancellation.
- Testnet deployment manifest, threat model, reproduction guide, deck/whitepaper, and demo video.

## Non-goals

- Mainnet or production funds.
- Consumer credit decisions, KYC, or regulated reserve claims.
- Global or complete credit-history claims.
- Attestcoin Writability, bridging, tokenomics, a DAO, or a chatbot-first experience.
- Stablecoin issuance, generic token creation, or claims that `prUSD` is production money.
- A self-service multi-pool factory unless it is completed only after the mandatory public proof-to-enforcement path.
- Any paid AI tier required for hackathon reproduction.

## Definition of done

An independent reviewer can start from one real Sepolia transaction, trace its Attestcoin proof into a typed Creditcoin fact, reproduce the AI feature and decision artifacts, inspect the controller's policy checks, and observe a real Creditcoin loan-capacity change. An authorized manager can reserve and restore capacity through the product without exposing a private key. Restarting the worker must not accept the fact twice.
