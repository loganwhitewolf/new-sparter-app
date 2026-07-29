---
phase: 260729-hiz
plan: 01
subsystem: ui, categorization
tags: [expense-detail, title-edit, seed-patterns, spesa-quotidiana, alloggio, audit]

requires: []
provides:
  - Expense detail header parity with transaction detail (back-only shell + detail title wrap)
  - Hardened system spesa-quotidiana alternatives + travel→alloggio pattern
  - Risky-alt section in audit-pattern-overlaps
  - grocery-pattern-hardening-REPORT.md
affects: [imports, categorization, expense-detail]

tech-stack:
  added: []
  patterns:
    - "ExpenseTitleEdit variant inline|detail mirrors TransactionTitleEdit"
    - "DetailPageShell omits header title/amount when fields live in Dati/Riepilogo"
    - "Grocery alternatives prefer RESTRINGI with mercato/supermercat/discount context"

key-files:
  created:
    - .planning/grocery-pattern-hardening-REPORT.md
  modified:
    - components/expenses/expense-title-edit.tsx
    - components/expenses/expense-detail-client.tsx
    - tests/expense-title-edit.test.tsx
    - scripts/seed-patterns-data.ts
    - scripts/audit-pattern-overlaps.ts
    - tests/seed-patterns.test.ts
    - tests/categorization-match.test.ts

key-decisions:
  - "Travel-agency system pattern maps to alloggio at priority 5 (beats grocery 10)"
  - "Bare Ins/MD/coop/super/market/prix/forno/surname FPs restricted or removed per BRIEF"
  - "group-detail-client left untouched (discretion)"
  - "Did not run yarn db:seed-patterns — operator step in report only"

patterns-established:
  - "Detail title editors use variant=detail with break-words; lists keep truncate"
  - "Audit flags short/boilerplate/unbounded alts without rewriting applyTier1Regex"

requirements-completed:
  - EXPENSE-TITLE-PARITY-260729-hiz
  - GROCERY-PATTERN-HARDEN-260729-hiz

coverage:
  - id: D1
    description: Expense detail shell is back-only; Dati title wraps via ExpenseTitleEdit variant=detail; inline truncate preserved
    requirement: EXPENSE-TITLE-PARITY-260729-hiz
    verification:
      - kind: unit
        ref: tests/expense-title-edit.test.tsx
        status: pass
    human_judgment: true
    rationale: Visual parity of /expenses/[id] header vs transaction detail needs a quick human glance
  - id: D2
    description: Fineco travel SEPA no longer grocery; FP/TP lists locked; travel→alloggio; audit risky-alts; report complete
    requirement: GROCERY-PATTERN-HARDEN-260729-hiz
    verification:
      - kind: unit
        ref: tests/categorization-match.test.ts#spesa-quotidiana grocery hardening
        status: pass
      - kind: unit
        ref: tests/seed-patterns.test.ts
        status: pass
      - kind: other
        ref: yarn check:language
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-29
status: complete
---

# Phase 260729-hiz Plan 01: Expense title parity + grocery harden Summary

**Expense detail matches transaction header/title behavior; spesa-quotidiana no longer false-positives Fineco `Ins:` travel SEPA, with travel→alloggio and a full §3 decision report.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-29T10:40:28Z
- **Completed:** 2026-07-29T10:46:00Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Stripped expense `DetailPageShell` header title/amount; `ExpenseTitleEdit` gained `variant` inline|detail with break-words on detail.
- Hardened grocery system regex (Ins→mercato, Tier A–D RESTRINGI/RIMUOVI/MANTIENI) + consistency-rule comment.
- Added travel-agency → `alloggio` (priority 5); extended audit risky-alts; wrote `.planning/grocery-pattern-hardening-REPORT.md`.
- Regression tests cover Fineco §1, FP/TP lists, travel winner, `validateSystemCategorizationPatterns()`.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 RED | `1bd9b84` | test: ExpenseTitleEdit detail variant failing tests |
| 1 GREEN | `fca58c3` | feat: expense detail title parity |
| 2 patterns | `245c4a2` | feat: harden spesa-quotidiana + travel→alloggio + tests |
| 2 audit/report | `40fa1a7` | feat: audit risky-alts + grocery harden report |

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None beyond plan threat model (T-hiz-01..04 mitigated as designed).

## BRIEF §6 DoD checklist

- [x] Every §3 item decided + motivated in report
- [x] Fineco §1 does not match grocery (test)
- [x] Both `\bins\b` and `\bin'?s\b` addressed
- [x] Dead `\bu!\b` removed
- [x] Tier D redundancies resolved coherently
- [x] No true-positive regressions (§4.4.3)
- [x] Consistency rule comment above pattern
- [x] Audit extended; output in report
- [x] Travel agency pattern added; no grocery collision
- [x] validateSystemCategorizationPatterns + tests + `yarn check:language` green
- [x] Report written
- [x] No production DB seed; propose `yarn db:seed-patterns` for operator

## Self-Check: PASSED

- FOUND: components/expenses/expense-title-edit.tsx
- FOUND: components/expenses/expense-detail-client.tsx
- FOUND: scripts/seed-patterns-data.ts
- FOUND: scripts/audit-pattern-overlaps.ts
- FOUND: .planning/grocery-pattern-hardening-REPORT.md
- FOUND: commits 1bd9b84, fca58c3, 245c4a2, 40fa1a7
- Branch: `quick/260729-hiz-expense-title-grocery-harden`
