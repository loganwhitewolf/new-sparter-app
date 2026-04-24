# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** L'utente vede in un colpo d'occhio dove vanno i suoi soldi — importa il CSV della banca, le spese si categorizzano da sole, la dashboard mostra il quadro completo.
**Current focus:** Phase 1 - Design System

## Current Position

Phase: 1 of 7 (Design System)
Plan: 0 of 5 in current phase
Status: Ready to execute
Last activity: 2026-04-24 — Phase 1 planning complete: 5 plans in 5 waves (Wave 0–4), verification passed

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Stack fisso — Next.js 16 App Router, Drizzle ORM + MySQL, Better Auth, Cloudflare R2
- Init: DAL pattern — lib/dal/ → lib/services/ → lib/actions/
- Init: Decimal.js obbligatorio per tutti gli amount — mai float JS nativo
- Init: Upload R2 via presigned URL (browser → R2 diretto, mai proxiato)
- Init: importFile() richiede db.transaction() per atomicita
- 2026-04-24: File import distingue piattaforme bancarie da versioni tracciato; analysis/preview conferma una coppia platform + formatVersion
- 2026-04-24: Frontend carica su R2 solo tramite presigned URL temporanea; credenziali R2 e `storageKey` restano backend-only

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3: Creare toDecimal() / toDbDecimal() utils PRIMA di qualsiasi scrittura di amount
- Phase 5: Import preview obbligatorio prima del commit (IMP-04 dipendenza critica)
- Phase 5: Detection deve scegliere piattaforma + versione tracciato con confidence, usando colonne/header/date/separatori/valuta e consentendo override manuale
- Phase 5: Tutti gli helper di importFile() devono accettare DbOrTx per rispettare il boundary di transazione
- Phase 2: Campi custom Better Auth/sessione (subscriptionPlan, role, userId) devono essere disponibili al server per feature gates e authorization

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | AI categorization Tier 3 (Trigger.dev) | Deferred | Init |
| v2 | UniCredit + N26 platform adapters | Deferred | Init |
| v2 | Column mapping UI per piattaforme non supportate | Deferred | Init |

## Session Continuity

Last session: 2026-04-24
Stopped at: Phase 1 planning complete — 5 PLAN.md files verified, ready to execute
Resume file: .planning/phases/01-design-system/01-01-PLAN.md
