# Reality Research: ProofReserve vs Resyvr

_Research date: 2026-09-10. Resyvr source revision: `c742b3cda8efd3fc5786b5e401ae13185398ade8`. This is a current-state comparison, not a prediction or guarantee of hackathon placement._

## Scope

This comparison asks which project currently presents the stronger BUIDL CTC submission, where each project uses Attestcoin and Creditcoin meaningfully, and what ProofReserve must improve to become more competitive. The projects target different primary sectors: Resyvr is an RWA issuance product; ProofReserve is a DeFi lending-risk product with a bounded AI component.

## Sources Checked

- The current [Resyvr repository](https://github.com/Webghost01-NG/resyvr), including contracts, dashboard, architecture, submission material, deployment evidence, tests, and V2 redemption prototype.
- The public [Resyvr application](https://webghost01-ng.github.io/resyvr/dashboard/#top) at desktop and mobile viewports.
- The current ProofReserve repository, contracts, application, deployment manifests, testnet evidence, tests, and generated browser build.
- Fresh local verification runs for both repositories.
- Public Sepolia and Creditcoin CC3 transaction/address references recorded by both projects.

## Verified Facts

### Product in one sentence

- **Resyvr:** a self-service system for creating a branded Creditcoin token whose supply is limited by reserve assets proven on Sepolia.
- **ProofReserve:** a Creditcoin lending pool whose lendable liquidity is reduced when Attestcoin-proven repayment facts indicate portfolio stress.

In plain language, Resyvr is closer to a **Shopify-style launchpad for reserve-backed tokens**. ProofReserve is a **safety brake for lending pools**.

### Attestcoin and Creditcoin integration

Resyvr uses a genuine Attestcoin proof of a Sepolia reserve deposit before its Creditcoin controller can mint the matching token amount. Its V1 evidence records a 5 test-USDC reserve deposit and an exact 5 rvUSD mint. Issuers are isolated through a factory, controller, token, reserve vault, and CTC activation bond.

ProofReserve uses seven genuine Attestcoin proofs: six Sepolia repayment facts and one checkpoint. Its Creditcoin evidence contract validates the source loan book, event semantics, borrower, group, sequence, epoch, and replay state. A bounded Gemini assessment was accepted by the Creditcoin controller, which moved the pool from 10% to 40% protected. The deployed pool changed from 90 to 60 prUSD lendable and rejects a 70 prUSD request that was permitted at the recorded NORMAL block.

Both projects therefore make Attestcoin a core authorization dependency rather than a decorative data display.

### Product surface

Resyvr exposes a connected-wallet issuer journey covering reserve-vault deployment, issuer-system creation, CTC bond activation, reserve approval and deposit, Attestcoin proof generation, minting, and multi-issuer portfolio management. Its interface also provides transaction recovery, balance and allowance checks, gas estimates, and proof progress.

ProofReserve now has three deliberately separate product surfaces:

1. A landing page that explains the 10/90 to 40/60 liquidity-gate outcome in the first viewport.
2. A live protected-pool application where a visitor can test 50, 70, and 95 prUSD requests against the deployed Creditcoin pool without a wallet or API key.
3. A permissioned pool-manager desk that verifies the connected CC3 account against the deployed owner, runs a live contract preflight, commits capacity for an approved borrower, exposes the CC3 receipt, and cancels the commitment to restore capacity.

The pool application now also exposes the decisive AI comparison: the disclosed count-based baseline reads four settled and two late facts and returns `WATCH` / 20%, while the reviewed Gemini artifact weighs 40 settled value against 500 late value and returns `STRESS` / 40% at 82% confidence. The screen then shows the Creditcoin-enforced 70 prUSD rejection. This comparison is displayed only when the active evidence root matches the published epoch-2 root.

Fresh browser checks produced these current contract outcomes:

| Request | Current CC3 outcome |
| --- | --- |
| 50 prUSD | Allowed |
| 70 prUSD | Blocked |
| 95 prUSD | Blocked |

The public capacity check remains read-only. The manager desk adds a real write path for the authorized operator, while public users still cannot mutate pool state. ProofReserve does not yet expose lender deposits, borrower draws, pool creation, or new risk-epoch submission from the browser.

### Verification depth

ProofReserve's fresh full check passes 25 Solidity tests, 16 risk-engine tests, one worker persistence/idempotence test, strict TypeScript checking, and a production application build. Its new no-key `pnpm verify:live` audit passes 64 public checks spanning seven Sepolia source receipts, seven Attestcoin acceptance receipts and processed query IDs, the epoch-2 root and totals, deterministic baseline, Gemini artifact hashes, enforcement receipt, current pool state, and historical/current loan simulations. It confirms 100 managed / 40 protected / 60 lendable and the 70 prUSD contract rejection.

Resyvr's fresh local contract run passes 55 Foundry tests, including fuzz and stateful invariant campaigns. Its V1 preflight and 79-check live evidence verifier pass. Dashboard structure, ABI encoding, TypeScript, unit, and submission-package checks also pass.

Resyvr's V2 live evidence verifier does **not** currently pass against the checked-out source revision. It reports an issuer-factory artifact hash mismatch:

- Expected: `0x7035cbd60a4e17464f580318b979b108f9b1259fe3ba4adb2513699cfc5262ce`
- Received: `0x6eea8f9b610390a0a6d069b2ad0149e7994ac8c951bd52f54f295b0d37204bf0`

Therefore Resyvr V1 is strongly reproduced, while the current V2 redemption evidence is not fully reproduced from the current repository artifact.

### Honest limitations

Resyvr's own architecture says that V1 is deposit-only. Its V2 prototype adds identified payouts and proof-finalized redemption, but still assumes issuer liveness and does not claim a trustless two-way stablecoin. The CTC bond is an activation and accountability mechanism, not dollar insurance. The reserve asset issuer remains trusted, and the software is unaudited testnet code.

ProofReserve demonstrates one configured pool, not a self-service pool network. Its manager can reserve and release loan capacity, but pool creation, public lender deposits, borrower draws, and automatic scenario creation are not exposed in the browser. The signed browser transaction still needs a manual wallet-extension QA pass before deployment. Its epoch-2 evidence proves that AI changed the result relative to a disclosed simpler rule, but the AI inference itself is reproduced from a committed reviewed artifact rather than re-called during the no-key audit.

## Inferences

### Current competitive judgment

If the projects were judged in their current states, Resyvr remains ahead in **product completeness**, **self-service workflow**, and **business expansion story**. Its application feels like something an issuer can operate, not only inspect.

ProofReserve is now ahead in **originality of the financial decision**, **depth of Attestcoin use**, **clarity of the Attestcoin → AI → contract authority boundary**, and **direct DeFi consequence**. Its liquidity-gate landing page is at least as quickly understandable as Resyvr's hero, the AI-difference panel proves why the model changes the decision, and the new pool-manager workflow gives an authorized operator a real financial action. Resyvr still covers a broader issuer lifecycle.

| Area | ProofReserve | Resyvr | Current edge |
| --- | --- | --- | --- |
| 30-second explanation | Concrete lending safety brake | Concrete reserve-backed issuance | Tie |
| Meaningful Attestcoin use | Seven verified facts jointly drive reserve enforcement | One verified reserve deposit gates minting | ProofReserve |
| Creditcoin-native consequence | Pool liquidity is contract-limited | Token minting and issuer bond live on CC3 | Tie |
| Originality | Multi-fact portfolio risk and bounded AI | Strong but familiar proof-of-reserves issuance | ProofReserve |
| Usable end-to-end workflow | Public capacity test plus permissioned commit/cancel manager flow | Broader multi-step self-service issuer workflow | Resyvr, narrower edge |
| Reproducible verification | 64-check cross-chain-to-contract live audit | 79-check V1 verifier and stronger contract suite | Narrow Resyvr edge |
| AI necessity | Baseline WATCH versus Gemini STRESS is publicly reproduced | Not an AI product | ProofReserve |
| Expansion/business story | Future reusable pool-risk controller | Factory already supports multiple issuers | Resyvr |

### Track judgment

ProofReserve should enter the **DeFi track**. The working product is a lending-pool liquidity control, while AI is its differentiator. Epoch 2 now demonstrates why the AI layer changes the decision without giving it custody or final authority.

### Top-three judgment

No honest analysis can guarantee a top-three placement or the grand prize. ProofReserve now has a credible top-three submission and a slight strategic edge for this hackathon's Attestcoin theme, while Resyvr remains the more complete operator product. ProofReserve should not restart: its core idea is differentiated, publicly deployed, and now proves both AI necessity and the full cross-chain enforcement trail.

The highest-value next step is now a manual wallet-extension QA pass of the signed manager flow, followed by deployment and submission packaging. After that, a lender deposit path would expand the product more meaningfully than a generic token factory, which would duplicate Resyvr's territory and make Attestcoin less central to ProofReserve's unique value.

### Updated scorecard

These scores estimate current hackathon submission strength, not code quality in isolation and not guaranteed judging results.

| Project | Score | Why |
| --- | ---: | --- |
| ProofReserve | 9.1 / 10 | Stronger theme fit, multi-fact Attestcoin depth, demonstrated AI necessity, live financial consequence, public audit, and a permissioned manager workflow; signed wallet QA and deployment remain. |
| Resyvr | 8.8 / 10 | More complete self-service product and broader contract testing; familiar proof-of-reserves pattern, and the checked V2 verifier currently fails its artifact-hash check. |

## Unknowns And Questions

- The full set and final quality of submitted hackathon projects are not yet known.
- The organizers have not supplied a complete weighted judging rubric beyond the stated importance of meaningful Attestcoin integration.
- No external Creditcoin lending operator has yet validated demand for ProofReserve's dynamic reserve policy.
- Resyvr may repair its V2 artifact mismatch after the checked revision.
- ProofReserve's redesigned application is local until its commit is pushed and deployed.

## Not Included

- No claim about either team's eligibility, ownership, or legal compliance.
- No security audit conclusion; passing tests do not make either project production-safe.
- No estimate of monetary value, adoption, investment approval, or guaranteed prize placement.
- No changes to the Resyvr repository.
