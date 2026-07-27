---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-07-23T15:00:21.941Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 73 | deviation | drizzle/migrations/0029_reimbursement_backfill.sql |  | Backfill filters out transaction_pair rows whose outflow leg has no expense_id (WHERE outflow_expense_id IS NOT NULL) — deliberate, structurally required by D-03; Plan 73-02's row-count reconciliation must treat this as an expected discrepancy class | open |  | 2026-07-23T15:00:21.874Z |  |
| 2 | 73 | deviation | drizzle/migrations/0029_reimbursement_backfill.sql |  | Backfill migration not numerically proven against real historical transaction_pair rows (local dev DB had 0 rows at execution time) — only proven via Task 3's seeded N=1 fixture | open |  | 2026-07-23T15:00:21.941Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "73",
    "file": "drizzle/migrations/0029_reimbursement_backfill.sql",
    "line": null,
    "description": "Backfill filters out transaction_pair rows whose outflow leg has no expense_id (WHERE outflow_expense_id IS NOT NULL) — deliberate, structurally required by D-03; Plan 73-02's row-count reconciliation must treat this as an expected discrepancy class",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T15:00:21.874Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "73",
    "file": "drizzle/migrations/0029_reimbursement_backfill.sql",
    "line": null,
    "description": "Backfill migration not numerically proven against real historical transaction_pair rows (local dev DB had 0 rows at execution time) — only proven via Task 3's seeded N=1 fixture",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T15:00:21.941Z",
    "resolved_at": null
  }
]
````
