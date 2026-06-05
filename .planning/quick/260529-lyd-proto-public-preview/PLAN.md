---
quick_id: 260529-lyd
slug: proto-public-preview
date: 2026-05-29
branch: prototype/dashboard-overview
---

# Quick Task: esporre l'area prototipi in Vercel Preview

## Goal

Rendere il prototipo throwaway della dashboard overview (5 varianti A–E) visibile a
stakeholder esterni senza login e senza impatto sul prodotto, abilitato solo nei
preview deployment di Vercel.

## Approach

- Spostare la route fuori dal gruppo autenticato `(app)` → `app/proto/overview/`.
- Layout `app/proto/layout.tsx` autonomo: `notFound()` se manca `PROTOTYPES_ENABLED`
  (env scoped su Vercel Preview → 404 in Production), `robots: noindex`.
- `proxy.ts`: esentare `/proto` dal redirect a `/login` (resta solo session-check).
- Aggiornare NOTES.md (accesso/preview) e CLAUDE.md (contesto hosting Vercel).

## Scope guard

Committare SOLO: `app/proto/`, la singola riga `/proto` in `proxy.ts`, `CLAUDE.md`,
questo artefatto. NON includere il WIP fase-38 (auth.ts, import/onboarding, e gli altri
hunk di proxy.ts) né `.claude/worktrees/`.

## Verification

- `npx tsc --noEmit` pulito su `app/proto` + `proxy.ts`.
- `yarn lint app/proto proxy.ts` pulito.

## Out of scope

- Deploy su Vercel (manuale, l'operatore non ha accesso da qui).
- Cattura del verdetto / scelta variante (dopo la demo al PO).
