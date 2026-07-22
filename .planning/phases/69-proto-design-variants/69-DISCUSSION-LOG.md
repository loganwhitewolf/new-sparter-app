# Phase 69: proto-design-variants - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 69-proto-design-variants
**Areas discussed:** Design direction (proposals), Comparison UX (defaulted), Content scope (defaulted), Winner lock (defaulted)

---

## Design direction (proposals presented)

| Option | Description | Selected |
|--------|-------------|----------|
| A — Dashboard as manifesto | Full-bleed real overview screenshot; brand + headline + CTAs | partial |
| B — Editorial quiet | Type-led, atmosphere, marketing fonts distinct from app | partial |
| C — Three-beat flow | Homepage as mini Come funziona vertical beats | |
| A + touch of B | Manifesto screenshot + editorial typography/atmosphere | ✓ |

**User's choice:** “procedi come hai proposto” — accept recommended default A+B and accompanying defaults (no further gray-area interview).
**Notes:** User declined discussing the four gray areas; requested cool first-version proposals instead. Agent presented A/B/C + recommended A+B; user approved proceed-as-proposed.

---

## Comparison UX (Claude default, user-approved via proceed)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate `/proto/branding-{a,b,c}` | As sketched in ARCHITECTURE.md | |
| Hub + `?variant=` + switcher | Prototype UI skill pattern | ✓ |
| Hub index linking to separate pages | Hybrid | |

**User's choice:** Accepted via “procedi come hai proposto”
**Notes:** Overrides research example of separate branding-a/b/c as primary UX; separate paths remain optional share aliases.

---

## Content scope (Claude default, user-approved via proceed)

| Option | Description | Selected |
|--------|-------------|----------|
| First viewport only | Brand + headline + CTA + visual | |
| Full homepage proto | Hero + 2 benefits + closing CTA | ✓ |
| Homepage + Come funziona stub | Extra page in proto | |

**User's choice:** Accepted via proceed-as-proposed
**Notes:** Come funziona deferred to Phase 71.

---

## Winner lock (Claude default, user-approved via proceed)

| Option | Description | Selected |
|--------|-------------|----------|
| `app/proto/branding/NOTES.md` | Overview-proto ritual | ✓ |
| REQUIREMENTS-only checkbox | No design notes | |
| Planning-only artifact | No in-tree NOTES | |

**User's choice:** Accepted via proceed-as-proposed
**Notes:** NOTES.md is design-lock SoT for Phase 71 handoff.

---

## Claude's Discretion

- Exact structural axes for the three variants within A+B
- Exact Italian copy variants
- Screenshot asset vs labeled placeholder for first Preview
- Switcher chrome styling

## Deferred Ideas

- Public layout / proxy / production pages / legal / SEO — Phases 70–73
- Pricing, bank linking, video hero, analytics — out of scope / BRAND-F*
