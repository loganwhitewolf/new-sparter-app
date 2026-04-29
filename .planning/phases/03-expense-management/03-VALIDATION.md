---
phase: 3
slug: expense-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (or vitest.config.mts — Wave 0 installs if absent) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | EXP-01 | — | N/A — schema migration | manual | `npx drizzle-kit generate && npx drizzle-kit migrate` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | EXP-01 | — | Seed loads categories/subcategories | manual | `npx tsx drizzle/seed.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | EXP-01 | T-3-01 | userId scoped on insert | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | EXP-01 | T-3-01 | userId scoped on update | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | EXP-01 | T-3-01 | userId scoped on delete | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | EXP-02 | — | Filters return correct subset | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | EXP-02 | — | URL params preserved on navigate | manual | browser check | — | ⬜ pending |
| 03-04-01 | 04 | 3 | EXP-03 | T-3-02 | Bulk update rejects foreign IDs | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 3 | EXP-03 | T-3-02 | Bulk update sets status=3 + subCategoryId | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — install vitest + @vitejs/plugin-react if absent
- [ ] `tests/lib/dal/expenses.test.ts` — stubs for EXP-01 (create/update/delete userId scoping)
- [ ] `tests/lib/dal/expenses-filters.test.ts` — stubs for EXP-02 (filter query logic)
- [ ] `tests/lib/actions/bulk-categorize.test.ts` — stubs for EXP-03 (IDOR guard + bulk update)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drizzle schema migration applies cleanly | EXP-01 | DDL — cannot unit test | `npx drizzle-kit generate && npx drizzle-kit migrate` then verify tables exist |
| URL search params survive page refresh | EXP-02 | Browser state | Apply filters, refresh, confirm params in address bar and table filters |
| Floating action bar appears on row select | EXP-03 | DOM/visual | Select ≥1 row, confirm FAB renders with correct count |
| Toast notifications fire on success/error | EXP-01/EXP-02 | UI feedback | Create/update/delete expense, confirm sonner toast appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
