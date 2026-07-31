---
id: 260731-hhv
status: complete
date: 2026-07-31
branch: gsd/quick-260730-o82-tx-direction-multi
waves: 3
---

# Quick Task 260731-hhv — SUMMARY

## Goal

Chiudere i punti PRONTO + bug 3.7 del contratto feedback UX/UI Sparter, con decisioni discuss lockate; deferred 2.4 / 3.8 / 3.9.

## Result

**status: complete** — 3 waves executed on existing branch `gsd/quick-260730-o82-tx-direction-multi` (no new branch, no worktree).

| Wave | Plan | Status | Key commits |
|------|------|--------|-------------|
| 01 | Contrast + onboarding + Categorizza | complete | `2779354d`, `0cb248fa`, `6005c0b2` |
| 02 | Bug 3.7 + welcome/dashboard | complete | `f9e848b0`, `d334f499`, `7fa0b690`, `572a7bcd` |
| 03 | Taxonomy + pattern copy + amort rename | complete | `7488842a`, `56cc07e3`, `86d234c3`, `a92ef98a` |

## Delivered vs contract

| Item | Result |
|------|--------|
| 1.1–1.4, 2.1–2.2 | `--secondary-readable` token; stepper centered ≥16px; dropzone white/`#717171`; categorize contrast |
| 2.3 | Split → Carburante + Ricarica auto elettrica (seed-extras + patterns) |
| 3.1 | Welcome: sole CTA "Vai alla dashboard" |
| 3.2 | Verified already linked (OverviewNudge) — no code change |
| 3.3 | Empty pattern suggestions box hidden |
| 3.4 | Natural IT pattern copy; no user-facing "regex" |
| 3.5 | Expenses month-multi filter (D-11 override) |
| 3.6 | Entrate/Uscite KPI cards navigable |
| 3.7 | Fixed: stale `category_id_seq` after explicit-id seed |
| 3.10 | UI "Spese dilazionate"; route `/amortizations` unchanged |

## Deferred (unchanged)

- 2.4 subcategory hover/selected / Più usate IA
- 3.8 dashboard visual hierarchy (needs mockup)
- 3.9 Bilancio tasso/20% domain definition

## Notable findings

- **3.7 root cause:** `category_id_seq` desynced (`last_value` stale vs `MAX(id)`); pkey 23505 was mislabeled as duplicate name. Healed in DAL + seed setval + seed-extras step.
- **2.3 local migrate:** 2 expenses → carburante, 0 EV, 7 history.to, 1 pattern; old slug deactivated.
- Twin dir typo `…-form-pronto` removed; canonical is `…-fix-pronto`.

## Locked decisions honored

D-01 link nudge · D-02 amort UI rename only · D-03 no "regex" · D-04 Carburante / Ricarica auto elettrica
