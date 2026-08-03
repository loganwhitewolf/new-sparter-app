---
id: 260731-hhv
title: UX contratto feedback Sparter — fix PRONTO + bug Crea categoria
status: ready
date: 2026-07-31
waves: 3
---

# Quick Plan Index: 260731-hhv — UX contratto feedback Sparter

## Goal

Chiudere i punti **PRONTO** + il bug **3.7** del contratto feedback UX/UI (onboarding, Categorizza, Benvenuto/Dashboard), rispettando le decisioni locked in `260731-hhv-CONTEXT.md`. Non implementare i deferred.

## Locked decisions (summary)

| ID | Item | Decision |
|----|------|----------|
| **D-01** | 3.2 | Tag "Movimenti da categorizzare" → link a movimenti uncategorized (`/transactions?status=uncategorized&months=…`). Non rimuovere. |
| **D-02** | 3.10 | Rename UI only → "Spese dilazionate" (o etichetta consumer coerente). Route `/amortizations` e slug invariati. |
| **D-03** | 3.4 | Copy naturale IT; nessuna "regex" user-facing. Draft: "Regole automatiche", "Aggiorna la regola…", esempi senza flag `/i`. |
| **D-04** | 2.3 | Split → **Carburante** + **Ricarica auto elettrica** (nuovi slug). Additive `seed-extras` + update `seed-patterns-data`. Mai editare shape di `seed-data.ts`. |

Also locked (CONTEXT, no D-id): contrasto secondario unificato (1.2/1.4/2.1); chip Categorizza restano Tutte/Entrate/Uscite/Accantonamenti/Trasferimenti (non rinominare in Abbonamenti).

## Waves

| Wave | File | Scope |
|------|------|--------|
| **01** | [`260731-hhv-01-PLAN.md`](./260731-hhv-01-PLAN.md) | Contrast + onboarding + Categorizza UI (1.1–1.4, 2.1–2.2) |
| **02** | [`260731-hhv-02-PLAN.md`](./260731-hhv-02-PLAN.md) | Welcome/Dashboard PRONTO + bug 3.7 (**3.7 first**, then 3.1–3.6) |
| **03** | [`260731-hhv-03-PLAN.md`](./260731-hhv-03-PLAN.md) | Taxonomy split 2.3 + pattern copy 3.4 + amort UI rename 3.10 |

**Execution order:** wave 01 → 02 → 03. Wave 01 and wave 03 have no hard file overlap with each other, but wave 02 should follow 01 so onboarding CTA (3.1) lands after welcome/contrast polish if shared onboarding files collide — treat waves as sequential.

## Deferred (do not implement)

- **2.4** — subcategory hover/selected / "Più usate" IA (needs colleague confirmation)
- **3.8** — dashboard visual hierarchy redesign (needs mockup)
- **3.9** — Bilancio tasso/20% domain definition (needs CONTEXT.md write-up first)

## Context

- Contract: `/Users/andreabernardini/Downloads/sparterfeedbackcontratto.md`
- Locked discuss: `260731-hhv-CONTEXT.md`
- Project rules: `CLAUDE.md` (seeds additive, layers, language)

## Branch

Execute on **`gsd/quick-260730-o82-tx-direction-multi`** (user locked). No new branch, no worktree isolation.

## Resume

`/gsd-quick resume 260731-hhv` → start from this file; execute unfinished wave PLAN files in order on the current branch.
