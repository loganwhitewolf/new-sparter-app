---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: PDF Import
current_phase: 57
current_phase_name: pdf-import-trade-republic
status: executing
stopped_at: Completed 56-01-PLAN.md
last_updated: "2026-06-26T12:34:56.604Z"
last_activity: 2026-06-26
last_activity_desc: Phase 57 execution started
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-25)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 57 — pdf-import-trade-republic

## Current Position

Phase: 57 (pdf-import-trade-republic) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-06-26 — Phase 57 execution started

Progress bar: `░░░░░░░░░░░░░░░░░░░░` 0% (0/2 phases)

## Roadmap (v2.2 — Phases 56–57)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 56 | import-format-refactor | IFMT-01, IFMT-02, IFMT-03, IFMT-04, IFMT-05 | Not started |
| 57 | pdf-import-trade-republic | PDF-01, PDF-02, PDF-03, PDF-04, PDF-05 | Not started |

**Design contract:** LOCKED (ADR 0013/0014, CONTEXT.md, 2026-06-25 grill). No discovery to redo.

**Phase 56 invariant:** i 6 import CSV/XLSX esistenti producono `transactionHash` identici prima e dopo il refactor.

**Phase 57 invariant:** il parsing PDF non bypassa il pipeline esistente — le righe estratte passano per detector/normalize/dedup/preview invariati.

## Accumulated Context

### Decisions

Design contract is LOCKED. Do not re-derive the approach:

- ADR 0013: il contratto di parsing (`delimiter`, `*Column`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `descriptionStripPattern`, `amountType`) si sposta da `platform` a `import_format_version`; `platform` resta pura identità; behavior-preserving, regression-gated su fixture reali.
- ADR 0014: per-banca, non generico; template deterministico che riconosce il documento per marker ed estrae solo la sezione canonica dei movimenti; normalizzato a `ParsedImportFile` con header sintetici; segno via coordinate X (`unpdf`, serverless); catena saldi come guard esplicita; `pdf-parse` scartato (testo piatto, no coordinate).
- CONTEXT.md: "Platform" = pura identità fornitore; "Import Format" = contratto versionato; "Sezione canonica dei movimenti" = solo "TRANSAZIONI SUL CONTO" per Trade Republic; "PANORAMICA TRANSAZIONI" e "PANORAMICA DEL SALDO" scartate.
- Migration path: `drizzle-kit generate` + `scripts/migrate.ts` + step additivo in `seed-extras.ts` — mai `drizzle-kit push` in produzione.
- `unpdf` scelto per coordinate X (serverless-ready); `pdf-parse` scartato.
- Categorizzazione automatica delle descrizioni TR è fuori scope — follow-up via `regex-discovery` + `seed-patterns`.
- OCR/scanned PDF fuori scope.
- Parser PDF generico fuori scope.
- [Phase ?]: Regression test written BEFORE any column move — pins transactionHash of all 7 CSV fixtures as static hex literals (IFMT-02)
- [Phase ?]: Schema transition migration: 12 contract columns added nullable to importFormatVersion; platform columns untouched until Plan 03 data copy
- [Phase ?]: Migration 0021_glorious_callisto.sql produced via drizzle-kit generate — ADD COLUMN only on import_format_version, no DROP, applied at operator deploy time
- [Phase ?]: platform Drizzle import removed from seed-extras.ts — no other step references the table object after Step 2 became a no-op (IFMT-05)
- [Phase ?]: application/octet-stream added as defensive PDF MIME fallback (browser Assumption A5); extension check still constrains file kind
- [Phase ?]: initiate route required no code change — PDF support flows through InitiateUploadSchema transparently
- [Phase ?]: 5 MB size cap preserved unchanged per D-05/T-57-02-01
- [Phase ?]: costante singola nel parser
- [Phase ?]: allowlist approach evita scope creep

### Codebase facts rilevanti per v2.2 (da verificare prima dell'implementazione)

- `platform` contiene attualmente: `delimiter`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `amountColumn`, `descriptionColumn`, `dateColumn`, `descriptionStripPattern`, `amountType` — tutti da spostare su `import_format_version`.
- `import_format_version` contiene attualmente: `headerSignature`, `notes`, `version`, `platformId` — riceverà il contratto di parsing da `platform`.
- Detector: `lib/services/import.ts` — `scoreCandidate` legge i campi di parsing da `platform`; va re-pointed a `import_format_version`.
- `normalizeTransactionRow` / `ImportPlatformConfig`: tipi e logica di normalizzazione usano i campi di parsing da `platform`; va aggiornato.
- `seed-data.ts` / `seed.ts`: colonne di parsing presenti sulle righe Platform; da spostare sulle righe `import_format_version` corrispondenti.
- `seed-extras.ts`: aggiungere uno step additivo per migrare le righe esistenti in produzione.

### Planning Risk

Nessuno aperto. Il design è LOCKED e documentato in ADR 0013/0014. Il gating via regression test sui fixture reali (IFMT-02) è il guard principale del Phase 56.

### Blockers/Concerns

Nessuno.

### Quick Tasks Completati (carryover da v2.1)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260609-fru | Dashboard overview prototype fixes | 2026-06-09 | 5ebd690 |
| 260609-k2d | Transactions nature + in/out/transfer filters; 7 UI fixes | 2026-06-09 | cdc5997 |
| 260609-lcp | Cascading filters (type→nature, category→subcat); amount sign strip | 2026-06-09 | ffd4fc3 |
| 260615-dtm | Bank-agnostic regex-discovery tool | 2026-06-15 | d737b8e |
| 260615-n3t | Onboarding step-4 fix | 2026-06-15 | 1434308 |
| 260615-oiq | Onboarding private platform creation | 2026-06-15 | d5b590c |
| 260616-dlw | Fix transaction description sort | 2026-06-16 | c71d32e |

## Deferred Items

Items riconosciuti e posticipati al termine di v2.1 (2026-06-22):

| Category | Item | Status |
|----------|------|--------|
| verification_gap | 53-VERIFICATION.md | human_needed — 3 browser/visual checks |
| verification_gap | 55-VERIFICATION.md | human_needed — 2 visual checks |
| uat_gap | 53-UAT.md | diagnosed — 0 pending scenarios |
| quick_task | 260615-dtm-reusable-regex-discovery-tool | unknown — TOOL-01 deferred |
| quick_task | 260615-n3t-fix-recurring-onboarding-catalogazione | unknown — to evaluate |
| v2.1 | TOOL-01 | consolidate in-app + offline discovery — parked |
| v2.1 | GLOBAL-01 | file-independent suggestions — parked |
| v2.1 | DISM-01 | persistent dismissal of noisy suggestions — parked |
| v2.2 | TR categorization | regex-discovery + seed-patterns post-import — deferred |
| operator | R038/R039/R041 | live Vercel/Supabase/R2 deploy operator-pending |
| backlog | R029 | partial categorization revalidation coverage |

## Session Continuity

**Resume file:** None

**Stopped at:** Completed 56-01-PLAN.md

Last session: 2026-06-26T12:34:47.666Z
Resume: `/gsd-plan-phase 56` per pianificare il refactor import-format

**Next:** Phase 56 — import-format-refactor (IFMT-01..05)

## Operator Next Steps

- Pianificare Phase 56: `/gsd-plan-phase 56` (o `/gsd-discuss-phase 56` se serve approfondimento)
- Poi Phase 57: `/gsd-plan-phase 57` (dipende da Phase 56 completata)

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 49 P02 | 30m | 2 tasks | 5 files |
| Phase 50 P01 | 20m | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-02 | 35min | 2 tasks | 5 files |
| Phase 50-transaction-pairing P50-03 | 10min | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-04 | 25min | 2 tasks | 3 files |
| Phase 50-transaction-pairing P50-05 | 90min | 2 tasks + operator checkpoint + 5 fixes | 5 files |
| Phase 51 P01 | 15min | 2 tasks | 2 files |
| Phase 51 P02 | 15min | 2 tasks | 2 files |
| Phase 51 P03 | 8min | 3 tasks (TDD RED+GREEN + comment) | 3 files |
| Phase 52 P01 | 3 min | 2 tasks | 6 files |
| Phase 52 P02 | 2 min | 2 tasks | 2 files |
| Phase 52 P03 | 3 min | 3 tasks | 2 files |
| Phase 53 PP01 | 3min | - tasks | - files |
| Phase 53 P02 | 8min | 2 tasks (TDD RED+GREEN) | 4 files |
| Phase 53 P03 | 10min | 2 tasks + verification | 7 files |
| Phase 54 P01 | 3min | 3 tasks | 3 files |
| Phase 54 P02 | 5min | 2 tasks (TDD RED+GREEN) | 3 files |
| Phase 54 P03 | 8min | 3 tasks (TDD RED+GREEN) | 5 files |
| Phase 55 P01 | 7min | 2 tasks | 10 files |
| Phase 55 P02 | 3min | 2 tasks | 4 files |
| Phase 55 P03 | 2min | 3 tasks | 3 files |
| Phase 56 P01 | 10min | 1 tasks | 1 files |
| Phase 56 P02 | 8min | 2 tasks | 4 files |
| Phase 56 P03 | 4min | 3 tasks | 6 files |
| Phase Phase 56 PP56-04 | 8min | 3 tasks | 4 files |
| Phase 56 P05 | 3min | 4 tasks | 3 files |
| Phase 57 P02 | 2min | 2 tasks | 3 files |
| Phase 57 P03 | 10min | 2 tasks | 2 files |
| Phase 57 P05 | 3min | 1 tasks | 6 files |
