---
phase: 59-import-wizard-attach-format
plan: "01"
subsystem: dal
tags: [dal, drizzle, platform, import-wizard, tdd]
dependency_graph:
  requires: [Phase 58 — platform.proposedByUserId, platform.reviewStatus schema]
  provides: [listAttachablePlatforms, AttachablePlatform type]
  affects: [lib/dal/import-formats.ts, tests/import-private-formats-dal.test.ts]
tech_stack:
  added: []
  patterns: [Drizzle injectable-db, APPROVED_REVIEW_STATUS constant reuse, makeQueryChain proxy mock]
key_files:
  created: []
  modified:
    - lib/dal/import-formats.ts
    - tests/import-private-formats-dal.test.ts
decisions:
  - "Ordine alfabetico per platform.name via .orderBy(platform.name) — Claude's Discretion da CONTEXT.md"
  - "Query solo su tabella platform (no inner join su importFormatVersion) — colonne necessarie tutte su platform"
  - "makeQueryChain proxy non valuta predicati SQL; esclusioni cross-user/isActive=false documentate come integration-test concern"
metrics:
  duration: "2m"
  completed: "2026-06-29"
status: complete
---

# Phase 59 Plan 01: listAttachablePlatforms DAL Query Summary

**One-liner:** `listAttachablePlatforms` + `AttachablePlatform` type in DAL — query platform per wizard step 1 con visibilità approved-OR-own-pending scoped a isActive=true, ordinata per nome.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add listAttachablePlatforms query and AttachablePlatform type to DAL | 8ea552a | lib/dal/import-formats.ts |
| 2 | Extend DAL test suite with listAttachablePlatforms coverage | 106b449 | tests/import-private-formats-dal.test.ts |

## What Was Built

### lib/dal/import-formats.ts

Aggiunta della funzione DAL per il wizard step 1 (D-07 da CONTEXT.md):

**`AttachablePlatform` type** — shape minima per lo step 1:
- `id: number`, `name: string`, `slug: string`, `reviewStatus: string`

**`listAttachablePlatforms(userId, database?)` function** — visibilità ADR 0015:
- WHERE `isActive = true` AND (`reviewStatus = 'approved'` OR (`reviewStatus = 'pending'` AND `proposedByUserId = userId`))
- ORDER BY `platform.name` (alfabetico)
- SELECT `id`, `name`, `slug`, `reviewStatus` (nessuna colonna da importFormatVersion)
- Usa `ImportFormatDatabase` injectable-db type (esistente), `APPROVED_REVIEW_STATUS` constant (esistente), `and`/`or`/`eq` imports (esistenti)

**Threat T-59-01 mitigato:** il WHERE clause garantisce che platform pending di altri utenti non vengano mai selezionate (ASVS V4).

### tests/import-private-formats-dal.test.ts

Aggiunto `describe('listAttachablePlatforms', …)` block:
- Import di `listAttachablePlatforms` accanto a `loadImportFormatsForDetection`
- Case: approved + own-pending rows entrambi restituiti (contract del proxy mock)
- Case: empty array quando nessuna platform disponibile
- NOTE comment (stile esistente): esclusioni SQL-layer (cross-user-pending, isActive=false) sono integration-test concern

## Verification Results

```
Tests: 9 passed (9) — yarn test --run tests/import-private-formats-dal.test.ts
TypeScript: no errors in lib/dal/import-formats.ts — yarn tsc --noEmit
check:language: violations only in pre-existing files (expenses.ts:82, transactions.ts:200) — out-of-scope
```

## Acceptance Criteria Check

- [x] `lib/dal/import-formats.ts` exports `listAttachablePlatforms` AND `AttachablePlatform` (grep returns 2)
- [x] WHERE clause references `platform.isActive`, `platform.reviewStatus`, `platform.proposedByUserId`
- [x] Query orders by `platform.name` (`.orderBy(platform.name)` presente)
- [x] SELECT seleziona solo `id`, `name`, `slug`, `reviewStatus` (nessuna colonna importFormatVersion)
- [x] `describe('listAttachablePlatforms')` block presente (1 match)
- [x] Test `loadImportFormatsForDetection` non regressi (7/7 passano)

## Deviations from Plan

None — il piano è stato eseguito esattamente come scritto.

## TDD Gate Compliance

- RED gate (test falliva): confermato — `TypeError: listAttachablePlatforms is not a function` (2 test falliti)
- GREEN gate (implementazione): confermato — 9/9 test passano dopo l'aggiunta della funzione DAL

## Threat Flags

Nessun nuovo surface di sicurezza introdotto oltre a quanto già nel threat model del piano.

## Self-Check: PASSED

- [x] lib/dal/import-formats.ts exists and modified
- [x] tests/import-private-formats-dal.test.ts exists and modified
- [x] Commit 8ea552a exists: feat(59-01) DAL implementation
- [x] Commit 106b449 exists: test(59-01) test coverage
