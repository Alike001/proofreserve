# ProofReserve Dashboard Design System

## Source concepts

- `concepts/proofreserve-dashboard-desktop.png` — 1536×1024 primary screen.
- `concepts/proofreserve-dashboard-mobile.png` — 941×1672 responsive state.

## Visible copy and hierarchy

The first viewport must preserve the ProofReserve wordmark, Overview/Evidence/Decisions navigation, network control, the headline “Protect a lending pool before defaults spread.”, the stress state, 10%→40% reserve transition, 90→60 prUSD lendable transition, three-stage provenance flow, audit ledger, and verification action. No hero eyebrow is permitted.

## Tokens

- Canvas: true dark navy `#07131e`; raised surface `#0a1824`.
- Text: `#f5f7fb`; muted text `#aebbd0`; quiet text `#7f90a6`.
- Border: `#284054`; faint rule `rgba(137, 167, 193, 0.18)`.
- Provenance amber: `#ffb847`; risk coral: `#ff7b76`; safe mint: `#68e3b2`.
- Radius: 8px controls, 10px panels. Shadows are omitted; borders create depth.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px.
- Motion: 240ms control feedback; 900ms reserve-fill and provenance-line reveal. Respect reduced motion.

## Typography

- Display: Georgia with Times New Roman fallback, 58px/0.98 desktop; system sans 42px/1.08 mobile.
- UI/content: Inter-style system sans stack. Body 16px/1.55; labels 13px; controls 14px/600; metrics 48–56px/0.95.
- Hashes use the system monospace stack.

## Container model

The screen is an open max-width canvas, not a shell inside a giant card. Reserve comparison is an unframed two-column region. The three workflow stages use a single family of fine-bordered panels connected by one provenance rail. The desktop audit log is a table; mobile is a vertical event list.

## Components and state

- Quiet top navigation with one selected underline.
- Network control with mint status dot; it truthfully says Preview state until public addresses are configured.
- Coral stress status treatment.
- Reserve bars with coral protected segment and mint lendable segment.
- Numbered amber workflow markers and thin connecting rail.
- Primary mint verification button; disabled/busy/verified labels use the same geometry.
- Desktop audit table and mobile activity list share the same four records.

## Icon inventory

Only purpose-specific inline SVGs: shield/wordmark, chevron, evidence document, assessment warning, enforcement lock, arrow, external-link, and verification check. All use 1.7–2px rounded strokes and `currentColor`; no generic icon substitutions or text glyph arrows.

## Responsive behavior

At 760px and below, hide desktop navigation, switch the headline to sans, stack reserve states, turn the workflow into a vertical timeline, replace the table with event rows, and make the verification button full width. No horizontal overflow is allowed.
