# Phase 48: sql-migration-recategorization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 48-sql-migration-recategorization
**Areas discussed:** User-owned/custom category handling, Migration vs seed-extras boundary, Recategorization target

---

## User-owned/custom category handling

| Option | Description | Selected |
|--------|-------------|----------|
| System non-null | Active system subcategories must have `nature_id`; user-owned rows may stay NULL until UI can ask reliably. | yes |
| Everything non-null | Force `nature_id` on user-owned subcategories too using fallback or automatic derivation. | |
| Best effort only | Backfill where possible without a hard Phase 48 gate. | |

**User's choice:** System non-null.
**Notes:** Overrides inherit from linked system subcategories when possible. User-owned rows that cannot inherit stay unclassified. Verification must use targeted DB assertions.

---

## Migration vs seed-extras boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Seed-extras after migration | Migration SQL changes schema; `db:seed` and `db:seed-extras` do idempotent data transforms. | yes |
| Data inside migration SQL | Migration SQL performs schema and all data backfills/remaps. | |
| Minimal hybrid | Migration performs only minimal data work required for constraints; seed-extras does the rest. | |

**User's choice:** Seed-extras after migration.
**Notes:** Canonical order is `db:generate` -> review/patch migration -> `db:migrate` -> `db:seed` -> `db:seed-extras` -> verify. Manual patching of the generated migration is allowed when needed. Seed scripts must tolerate reruns; migration assumes normal pre-migration Drizzle state.

---

## Recategorization target

| Option | Description | Selected |
|--------|-------------|----------|
| Update expense and patterns | Treat recategorization as `expense.sub_category_id` and pattern target updates; transaction rows stay raw. | yes |
| Add category to transaction | Change the model so transaction rows also store `sub_category_id`. | |
| Future patterns only | Do not touch existing expenses; only improve future imports. | |

**User's choice:** Update expense and patterns.
**Notes:** Semantic recategorization uses explicit slug source->target maps, not description regex inference. Pattern conflicts are deduped then migrated. No `expense_classification_history` rows are created for this technical migration.

---

## Update session — 2026-06-11

**Areas discussed:** Migration safety / rollback, Misclassification fixes (MIG-02)

### Backup / rollback strategy

| Option | Description | Selected |
|--------|-------------|----------|
| pg_dump pre-migrate + restore | Mandatory snapshot before migrate; rollback = restore. No down-migration. | yes |
| Hand-written down-migration SQL | Reversible SQL alongside forward; risky/lossy with drops. | |
| Existing gate only, no formal backup | Rely on `apply-to-production` confirm; no dump mandate. | |

**User's choice:** pg_dump pre-migrate + restore → D-13.

### Staging-first

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory staging-first | Full sequence must run clean on staging before production. | yes |
| Recommended only | Best practice, not a blocking gate. | |

**User's choice:** Mandatory staging-first → D-14.

### MIG-02 fix granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Nature-level only | Fix `nature_id` on the subcategory; expenses stay put. | yes |
| Nature-level + expense rebucket | Also move misclassified expenses between subcategories. | |

**User's choice:** Nature-level only → D-15.

### income_extraordinary rebucket step

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm slugs, activate | Slug list is PO-confirmed/final; ensure backfill covers it, drop stale skip guard. | yes |
| Stay deferred | Keep no-op for Phase 48. | |
| Clarify against real DB first | Map actual DB state before deciding source→target. | |

**User's choice:** Confirm slugs, activate → D-16 (still nature assignment, not expense moving — consistent with D-15).

## the agent's Discretion

- Exact phase plan slicing and verification script shape.
- Whether to add tests around migration SQL text, seed-extras idempotency, or both.
- Exact `pg_dump`/restore command form and where the runbook lives.

## Deferred Ideas

- Phase 49 dashboard/filter/aggregation rewrite.
- Phase 49 removal of `exclude_from_totals`.
- Phase 50 explicit transaction pairing.
