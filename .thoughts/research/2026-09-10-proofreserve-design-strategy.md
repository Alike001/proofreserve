# ProofReserve Product and Design Strategy

## Executive conclusion

ProofReserve should remain a DeFi product built around a Creditcoin lending pool whose usable liquidity changes when Attestcoin verifies worsening repayment behavior on another chain. The current mechanism is differentiated and technically credible. The design problem is not a missing gradient, dashboard, or illustration; it is that the public experience has not consistently separated three jobs:

1. The landing page must explain the product to a first-time visitor.
2. The product must let a visitor exercise a real financial decision.
3. The evidence interface must let a technical reviewer verify why that decision changed.

The rejected pool-console concept combined all three jobs into a dense operator dashboard. It used too many bordered containers, too much small text, and no strong first-impression story. A better system requires a concise landing page and a distinct application surface.

The recommended positioning is:

> **A lending pool that knows when to stop lending.**
>
> ProofReserve watches verified repayments on other chains. When related borrowers fall behind, it protects more of the pool on Creditcoin—before losses spread.

This framing is understandable without prior knowledge of AI agents, oracle architecture, reserve basis points, Attestcoin precompiles, or cross-chain proofs. The technical terms remain available below the fold and inside the evidence interface.

## Research scope

This study evaluates the current ProofReserve mechanism and public interface; the published BUIDL CTC requirements; current Creditcoin and Attestcoin presentation; established DeFi lending and risk-management product patterns; public BUIDL CTC projects in the same design space; and research-backed homepage principles.

The goal is a practical design direction, not a prediction of hackathon placement.

## Product reality

ProofReserve currently has more substance than its interface suggests:

- Six repayment facts and one checkpoint originated on Ethereum Sepolia.
- Seven Attestcoin proofs were accepted on Creditcoin CC3.
- A bounded Gemini assessment was submitted.
- The Creditcoin controller increased the protected reserve from 10% to 40%.
- The pool's lendable balance fell from 90 prUSD to 60 prUSD.
- The deployed commitLoan path allows a 70 prUSD request at the historical normal block and rejects the same request in the current stress state.

These are public testnet outcomes, not browser-generated sample data. The pool contract also contains deposit, withdrawal, commitment, draw, and principal-repayment functions. The strongest product story is not “an AI risk dashboard.” It is “verified trouble on Ethereum changes what a lending pool is permitted to do on Creditcoin.”

Evidence: [ProofReservePool.sol](../../contracts/src/creditcoin/ProofReservePool.sol), [ReserveController.sol](../../contracts/src/creditcoin/ReserveController.sol), and [testnet-evidence.md](../../docs/testnet-evidence.md).

## Requirements translated into experience

| Requirement | Design consequence |
| --- | --- |
| Understood within 30 seconds | One plain-language headline, one sentence, and one visible before/after lending consequence in the first viewport. |
| Product, not demo | Avoid “run demo,” “reset state,” fake toggles, staged terminal output, and invented metrics. The main CTA opens a persistent protected-pool application. |
| Meaningful Attestcoin integration | Show that Ethereum repayment transactions become verified facts accepted on CC3, then expose the real proof and acceptance references. |
| Related to Creditcoin | The financial action is a Creditcoin pool decision, not merely a cross-chain report. Creditcoin remains the enforcement chain in every explanation. |
| Technical documentation | Preserve an evidence and integration path with contracts, source events, accepted proofs, decision hash, model inputs, and reproduction commands. |
| Testnet deployment | Put “Live on Creditcoin CC3 Testnet” next to the real application action, not among decorative badges. |
| CEIP potential | Present ProofReserve as a risk-control layer that additional Creditcoin pools can integrate, while truthfully identifying the current single-pool MVP. |

## What established products teach

### Morpho: separate the network story from operating interfaces

Morpho presents a broad credit-network promise on its corporate landing page, while separate applications serve consumers and vault curators. Its documentation distinguishes app builders, vault curators, AI-agent integrations, and protocol developers. The lesson is structural: do not force the landing page to also be the curator console, developer documentation, and forensic evidence explorer.[1]

### Aave: translate mechanics into an ordinary financial job

Aave's current consumer product opens with “The World's Savings App” rather than smart-contract architecture. It follows the promise with a product image and an interactive savings simulation. Its professional interface separately exposes deposit, borrow, capacity, collateral factor, health factor, and transaction review. The lesson is not to copy a savings product; it is to lead with the job and let the mechanism support it.[2]

### Aera: one dominant idea, then a simple operating model

Aera describes itself as onchain treasury management without burdensome rebalancing governance. Its public platform explanation uses Deposit → Execute → Grow and distinguishes the vault owner from the off-chain guardian. This maps closely to ProofReserve's bounded-authority story: evidence and models can recommend, but the pool contract owns the funds and rules.[3]

### Chaos Labs: a memorable metaphor can carry complexity

Chaos Labs uses one large “clarity through chaos” visual rather than many small dashboard panels. The headline and image create the first impression; product detail follows. ProofReserve similarly needs one signature visual—the liquidity gate—not an assortment of small crypto cards.[4]

### Gauntlet: professional credibility, but broad positioning

Gauntlet's landing page is clean and credible, with restrained navigation and one large visual. Its opening promise is broad. ProofReserve should borrow its visual restraint while being much more explicit about the financial consequence.[5]

## What current hackathon projects teach

### CrossCredit

CrossCredit has the most art-directed landing page in the reviewed set. “Repaid on Ethereum. Proven here.” is memorable and the serif typography distinguishes it from generic dashboards. A newcomer may still not immediately understand what financial action the proof unlocks. ProofReserve should match its confidence while showing the actual pool consequence above the fold.[6]

### index41

index41's strongest line is “Position inside a block was a claim. Now it is a fact.” It then provides an immediate “watch the proof” action and names the resulting payment. This is the best structure to borrow: an invisible fact becomes verified, and that fact produces one concrete action.[7]

### Spark

Spark offers the strongest borrower journey: pay on Sepolia, prove payment and solvency, open credit, withdraw, redeem, and repay. It demonstrates that judges value visible lifecycle steps. ProofReserve should not imitate its borrower scoring; it should expose its own pool-management lifecycle with equal clarity.[8]

### Recourse

Recourse exposes lender, borrower, and hunter transaction flows and a real facility lifecycle. It is operationally credible but complex. The lesson is that role-appropriate actions make a protocol feel like a product. ProofReserve needs pool-manager mode and open reviewer mode rather than one generic dashboard.[9]

### AttestFlow

AttestFlow opens with “Run Demo Pipeline,” “Reset State,” and a technical metrics console. Its repository also discloses mocked proof submission. This is the exact presentation pattern ProofReserve must avoid: technically interesting software looks disposable when the primary action says “demo.”[10]

## UX research findings

Nielsen Norman Group's homepage guidance says a homepage should communicate its unique value proposition through a simple, scannable tagline and compelling hero content. Its broader web-reading research finds that people scan rather than read word-for-word and pay attention to page content before navigation. This supports a first viewport with one claim, one explanation, one action, and one product consequence—not a navigation-heavy dashboard.[11]

Baymard's homepage research frames the homepage as the place where a newcomer answers three questions: what type of site is this, what can be done here, and what should be expected. It also warns against visually striking promotional content eclipsing navigation and product-finding paths. For ProofReserve, visual spectacle is useful only when it explains the lending decision.[12]

The Core Web Vitals guidance defines a good Largest Contentful Paint as no more than 2.5 seconds at the 75th percentile and good Interaction to Next Paint as no more than 200 milliseconds. A heavy WebGL hero or full-page video would work against fast comprehension and reliable judging. The signature visual should therefore be lightweight.[13]

## Recommended creative direction: The Liquidity Gate

The product needs one recognizable visual idea:

> Attestcoin-verified facts close part of a Creditcoin pool's lending gate before correlated losses spread.

The landing hero should show a single pool line containing 100 prUSD. In its normal state, 10 is protected and 90 can pass through the lending gate. After two verified late-payment facts arrive from Ethereum, the protected region expands to 40 and only 60 can pass. A 70 prUSD loan is visibly stopped at the gate.

This is not a fictitious animation. Every number corresponds to the deployed pool. The interaction can replay the historical and current contract-call results.

### Visual character

- **Background:** Ink black with a quiet midnight-blue cast, not a standard navy dashboard.
- **Creditcoin execution:** Electric cobalt blue.
- **Attestcoin evidence:** Pale ultraviolet and periwinkle.
- **Allowed state:** Restrained mint.
- **Protected or blocked state:** Warm coral.
- **Typography:** One expressive display face for the marketing statement, paired with a legible contemporary sans for body and application UI. Monospace is limited to hashes, blocks, and proof references.
- **Geometry:** Straight rails, vertical gates, cropped circles, and interrupted lines. Avoid repeated rounded cards.
- **Texture:** Subtle field grain or stipple inspired by verified data becoming solid.
- **Motion:** Repayment facts move along a thin line; after verification, the reserve boundary slides from 10 to 40; the 70 prUSD request meets the boundary and stops.

### What not to use

- No 3D coin as the central product image.
- No generic glowing orb.
- No bento grid.
- No robot or “AI agent” imagery.
- No “run demo” button.
- No invented TVL, APY, customers, or savings.
- No terminal-first interface.
- No dense control room in the first viewport.
- No exact replication of Creditcoin or Attestcoin branding.

## Landing-page architecture

### Hero: understand the product

**Headline:** A lending pool that knows when to stop lending.

**Body:** ProofReserve watches verified repayments on other chains. When related borrowers fall behind, it protects more of the pool on Creditcoin—before losses spread.

**Primary action:** Open the protected pool

**Secondary action:** See why 70 prUSD was blocked

**Product visual:** The live liquidity gate showing 100 total, 10 → 40 protected, 90 → 60 lendable, and a stopped 70 prUSD request.

The first viewport must identify “Live on Creditcoin CC3 Testnet” and “Cross-chain facts verified by Attestcoin” without turning them into badge clutter.

### Financial consequence: test the decision

The visitor enters a proposed loan amount. ProofReserve performs real historical and current contract simulations. The response shows the normal and current blocks, reserve and lendable amount at each block, allowed or blocked outcome, and a route to the evidence that caused any difference.

This is the product preview on the landing page, not the complete application.

### Mechanism: follow one fact

Use one concrete late repayment rather than generic feature cards:

1. A borrower becomes late on Ethereum Sepolia.
2. Attestcoin proves the source transaction.
3. Creditcoin accepts the fact.
4. The assessment recognizes correlated borrower-group risk.
5. The controller increases the reserve.
6. The pool refuses capacity it no longer has.

Each step should link to a real transaction or artifact where possible.

### Safety: AI cannot spend the pool

Explain the trust boundary in one strong statement:

> AI can recommend one of four reserve states. It cannot transfer funds, invent a percentage, lower protection immediately, or override the Creditcoin contract.

Expose the enforced policy checks as a restrained list, not a five-card grid.

### Product and ecosystem

State the current product boundary truthfully and show the integration direction. This is the CEIP-facing section: Creditcoin lending products could attach the controller to their own pool and configure permitted evidence sources and reserve bands.

### Evidence and final action

Show the canonical contracts, proof count, source chain, enforcement transaction, repository, documentation, and audit warning. End with “Open the protected pool,” not “Run the demo.”

## Application architecture

The application should be a separate route, visually related to the landing page but more operational:

- **Overview:** Assets, protected reserve, lendable liquidity, commitments, principal outstanding, active regime, and latest incident.
- **Loan desk:** Borrower and amount, read-only preflight, and manager-only loan commitment.
- **Evidence:** Source facts, proof-builder status, CC3 acceptance, checkpoint membership, and links.
- **Decision:** Exact features, deterministic baseline, Gemini output, confidence, reason codes, contract validation, and enforcement transaction.
- **Activity:** Deposits, commitments, draws, repayments, proof acceptance, assessments, and reserve changes.
- **Integration:** Contract addresses, supported chain, policy parameters, ABI snippets, and developer links.

Public reviewer mode should require no wallet. Manager actions should only appear after the pool-owner address connects. The application should not imply that a public visitor can mutate owner-only pool state.

## Thirty-second comprehension test

A new visitor should answer all five questions after the first viewport:

1. **What is it?** A protected lending pool.
2. **What problem does it solve?** The pool normally cannot see borrower trouble on other chains.
3. **What does Attestcoin do?** It proves external repayment facts.
4. **What does Creditcoin do?** Its contracts enforce how much liquidity remains lendable.
5. **What can I do?** Open the live pool or test why a loan was blocked.

If any answer requires scrolling into documentation, the landing page has failed.

## Hackathon fit

| Criterion | Fit after the recommended redesign |
| --- | --- |
| DeFi track | Core action changes lending-pool capacity. |
| Attestcoin as core feature | A cross-chain fact cannot influence the reserve until its proof is accepted on CC3. |
| Working integration | The seven-proof public path remains visible and independently inspectable. |
| Technical documentation | Evidence and integration routes expose setup, contracts, proofs, decision, and reproduction. |
| Testnet | Landing page and app display live CC3 state and real transaction links. |
| Product rather than demo | Named pool, persistent state, reviewer mode, manager role, loan desk, evidence inbox, and decision history. |
| AI role | Bounded recommendation with transparent features and onchain policy enforcement. |

## Recommended decision

Keep the product idea. Reject generic crypto-dashboard visual language. Build a concise, expressive landing page around the Liquidity Gate and a separate operational application around the protected pool lifecycle.

Submit to the DeFi track unless a new public epoch proves that Gemini changes an ambiguous deterministic result. The current deployed scenario establishes a strong DeFi consequence but does not establish that AI alone caused the outcome.

## Sources

1. Morpho, [The open credit network for the world](https://morpho.org/) and [Get Started](https://docs.morpho.org/get-started/), accessed September 2026.
2. Aave, [The World's Savings App](https://aave.com/app?lang=en), [Aave Pro User Guide](https://aave.com/blog/aave-pro-user-guide), and [Build with Aave Kit](https://www.aave.com/build), accessed September 2026.
3. Aera, [Optimal treasury management on Aera](https://www.aera.finance/platform), accessed September 2026.
4. Chaos Labs, [Clarity Through Chaos](https://chaoslabs.xyz/), accessed September 2026.
5. Gauntlet, [Onchain yield and risk management](https://www.gauntlet.xyz/), accessed September 2026.
6. CrossCredit, [public application](https://crosscredit.vercel.app) and [source repository](https://github.com/OoJae/crosscredit), accessed September 2026.
7. index41, [public application](https://index41.edycu.dev) and [source repository](https://github.com/edycutjong/index41), accessed September 2026.
8. Spark, [source repository](https://github.com/thesithunyein/spark), accessed September 2026.
9. Recourse, [source repository](https://github.com/Ridwannurudeen/recourse), accessed September 2026.
10. AttestFlow, [public application](https://attestflow.vercel.app) and [source repository](https://github.com/0xConsole/attestflow), accessed September 2026.
11. Nielsen Norman Group, [Homepage Design: 5 Fundamental Principles](https://www.nngroup.com/articles/homepage-design-principles/), [How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/), and [Is Navigation Useful?](https://www.nngroup.com/articles/is-navigation-useful/).
12. Baymard Institute, [Homepage Design Examples and UX Benchmark](https://baymard.com/homepage-and-category-usability/benchmark/page-types/homepage/10440-mcdonalds), accessed September 2026.
13. web.dev, [How the Core Web Vitals metrics thresholds were defined](https://web.dev/articles/defining-core-web-vitals-thresholds), updated May 2025.
