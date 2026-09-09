# Build Slice 06: Judge-Facing Product Dashboard

## Outcome

ProofReserve now has a responsive product surface that explains the complete value proposition without requiring a judge to read the contracts: verified repayment trouble on Sepolia causes a Creditcoin lending pool to protect more liquidity.

The primary screen shows the 10%→40% reserve change, 90→60 prUSD lending-capacity change, six Attestcoin facts, Gemini's bounded STRESS assessment, the blocked 70 prUSD request, and an auditable evidence/decision/enforcement ledger.

## Honest data modes

The default UI is visibly marked `Preview state`; it does not pretend local fixture data is a public deployment. When the four browser-safe `VITE_` RPC/address values are configured, the same surface reads the evidence counts, checkpoint root, controller regime/reserve, pool capacity, and latest reserve event from Creditcoin CC3. Secrets and Gemini calls remain server-side.

## Interaction


`Verify latest decision` reloads live public state when configured. In preview mode it still performs local reconciliation—fact totals, reserve bounds, and nonnegative lending capacity—and labels the result as locally verified. Transaction navigation is unavailable until a real public reserve transaction and explorer base URL exist.

## Visual verification

- Accepted concepts: `design/concepts/proofreserve-dashboard-desktop.png` and `design/concepts/proofreserve-dashboard-mobile.png`.
- Browser renders: `design/renders/proofreserve-dashboard-desktop.png` and `design/renders/proofreserve-dashboard-mobile.png`.
- Browser fallback: Playwright Chromium, because the built-in Browser/IAB capability was not exposed in this workspace.
- Native viewports checked: 1536×1024 desktop and 430×932 mobile.
- Desktop document width equals its 1536px viewport. Mobile document width equals its 430px viewport, with no horizontal overflow.
- Browser console after the final navigation: zero errors and zero warnings.

## Fidelity ledger

1. Copy and hierarchy: headline, reserve transition, three stages, metrics, ledger, and actions match the concepts. `Preview state` intentionally replaces `CC3 Testnet` until public addresses exist.
2. Layout: desktop preserves the open two-column hero, three connected stages, and table; mobile uses the accepted vertical timeline and activity list.
3. Typography: desktop keeps the editorial serif headline and disciplined UI sans; mobile switches the headline to the concept's compact sans treatment.
4. Palette and container model: dark navy canvas, coral risk, mint safety, amber provenance, fine borders, minimal shadow, and no glass/bento wrapper match the concepts.
5. Icons and motion: purpose-specific rounded-stroke SVGs match the shield, evidence, risk, lock, arrow, and external-link metaphors; provenance/reserve reveals respect reduced-motion preferences.
6. Responsive behavior: the final 430px render removed a 27px confidence-label overflow found in the first pass.
7. Core action: the verification button was clicked in-browser and reached the `Decision verified` state with the truthful message `Preview relationships verified locally.`

At widths below 470px, the secondary “Monitoring cross-chain risk” status text and category tags are intentionally hidden to protect legibility. No other material visual mismatch remains.
