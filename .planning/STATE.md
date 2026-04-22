# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** L'utente vede in un colpo d'occhio dove vanno i suoi soldi — importa il CSV della banca, le spese si categorizzano da sole, la dashboard mostra il quadro completo.
**Current focus:** Phase 1 - Design System

## Current Position

Phase: 1 of 7 (Design System)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-04-22 — Roadmap created, 7 phases, 21 v1 requirements mapped

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

- Init: Stack fisso — Next.js 15 App Router, Drizzle ORM + MySQL, NextAuth v5, Cloudflare R2
- Init: DAL pattern — lib/dal/ → lib/services/ → lib/actions/
- Init: Decimal.js obbligatorio per tutti gli amount — mai float JS nativo
- Init: Upload R2 via presigned URL (browser → R2 diretto, mai proxiato)
- Init: importFile() richiede db.transaction() per atomicita

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3: Creare toDecimal() / toDbDecimal() utils PRIMA di qualsiasi scrittura di amount
- Phase 5: Import preview obbligatorio prima del commit (IMP-03 dipendenza critica)
- Phase 5: Tutti gli helper di importFile() devono accettare DbOrTx per rispettare il boundary di transazione
- Phase 2: Campi custom NextAuth v5 (subscriptionPlan, role, userId) devono essere nei callback jwt + session e nel TypeScript augmentation

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | AI categorization Tier 3 (Trigger.dev) | Deferred | Init |
| v2 | UniCredit + N26 platform adapters | Deferred | Init |
| v2 | Column mapping UI per piattaforme non supportate | Deferred | Init |

## Session Continuity

Last session: 2026-04-22
Stopped at: Roadmap creato — pronto a pianificare Phase 1
Resume file: None
