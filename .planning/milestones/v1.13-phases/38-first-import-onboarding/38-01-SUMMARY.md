---
phase: 38-first-import-onboarding
plan: "01"
subsystem: dal-onboarding-foundation
tags: [dal, onboarding, routing, tdd, R-OB-01, R-OB-02, R-OB-07, R-OB-10]
dependency_graph:
  requires: []
  provides:
    - getTransactionCount (lib/dal/transactions.ts)
    - getTopUncategorizedExpenses (lib/dal/transactions.ts)
    - getFileCoveredMonths (lib/dal/imports.ts)
    - formatMonthRange (lib/utils/date.ts)
    - APP_ROUTES.onboarding (lib/routes.ts)
    - onboarding redirect guard (app/(app)/layout.tsx)
  affects:
    - app/(app)/layout.tsx (converted to async RSC with guard)
    - proxy.ts (forwards x-pathname header)
tech_stack:
  added: []
  patterns:
    - RSC onboarding gate via x-pathname header bridge
    - react cache() on read-only DAL functions without verifySession
    - DISTINCT ON parameterized SQL for deduplication
    - Intl.DateTimeFormat for Italian short-month formatting
key_files:
  created:
    - tests/date-utils.test.ts
    - tests/app-layout-guard.test.ts
  modified:
    - lib/dal/transactions.ts
    - lib/dal/imports.ts
    - lib/utils/date.ts
    - lib/routes.ts
    - app/(app)/layout.tsx
    - proxy.ts
    - tests/transactions-dal.test.ts
    - tests/imports-dal.test.ts
decisions:
  - "getTransactionCount accepts explicit userId (no verifySession) for RSC layout composability"
  - "x-pathname header set by proxy.ts overwrites any client-supplied value (T-38-01 mitigation)"
  - "LIMIT hard-capped at 100 in getTopUncategorizedExpenses (T-38-05 DoS guard)"
  - "getFileCoveredMonths uses innerJoin on file table for ownership (T-38-04)"
  - "formatMonthRange uses en-dash U+2013 separator, not hyphen-minus"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-28"
  tasks_completed: 3
  tests_before: 17 + 10 + 0 + 0 + 3 = 30
  tests_after: 24 + 18 + 4 + 5 + 3 = 54
---

# Phase 38 Plan 01: DAL Foundation + Onboarding Gate Summary

One-liner: Three DAL functions (transaction count, top uncategorized, file period), Italian month-range formatter, and RSC layout guard redirecting zero-transaction users to /onboarding via x-pathname header bridge.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | DAL — getTransactionCount + getTopUncategorizedExpenses | 315f751 | lib/dal/transactions.ts, tests/transactions-dal.test.ts |
| 2 | DAL + utils — getFileCoveredMonths + formatMonthRange | d3ebed7 | lib/dal/imports.ts, lib/utils/date.ts, tests/imports-dal.test.ts, tests/date-utils.test.ts |
| 3 | Route constant + RSC layout guard | 8c0423c | lib/routes.ts, proxy.ts, app/(app)/layout.tsx, tests/app-layout-guard.test.ts |

## Test Counts (before / after)

| Test file | Before | After |
|-----------|--------|-------|
| tests/transactions-dal.test.ts | 17 | 24 (+7 R-OB-02/R-OB-07) |
| tests/imports-dal.test.ts | 10 | 14 (+4 R-OB-10) |
| tests/date-utils.test.ts | 0 | 4 (new, R-OB-10) |
| tests/app-layout-guard.test.ts | 0 | 5 (new, R-OB-01) |
| tests/proxy-auth.test.ts | 3 | 3 (no regression) |
| **Total** | **30** | **50** |

## SQL emitted by getTopUncategorizedExpenses

```sql
SELECT DISTINCT ON (description_hash)
  id,
  title,
  description_hash AS "descriptionHash",
  total_amount AS "totalAmount"
FROM expense
WHERE user_id = $1
  AND sub_category_id IS NULL
  AND total_amount::numeric < 0
ORDER BY description_hash, ABS(total_amount::numeric) DESC
LIMIT $2
```

Parameters are bound via Drizzle `sql` tagged template (`$1` = userId, `$2` = safeLimitValue). Post-query JS sort reorders by `|totalAmount|` DESC because DISTINCT ON enforces ordering by `description_hash`.

## x-pathname Header Bridge Wiring

Per D-11, `proxy.ts` (Next.js middleware, Node.js runtime) sets `x-pathname` from `request.nextUrl.pathname` on every pass-through response before `NextResponse.next()`:

```ts
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-pathname', request.nextUrl.pathname)
return NextResponse.next({ request: { headers: requestHeaders } })
```

This header is NOT set on redirect responses (to `/login` or `/dashboard`). The layout reads it via `await headers()` — a Next.js 16 RSC API. Any client-supplied `x-pathname` is overwritten by the proxy before reaching the layout (T-38-01 spoofing mitigation).

No deviation from the plan for this wiring.

## Deviations from Plan

### Auto-fixed Issues

None from the plan's intent. One implementation note:

**[Rule 2 - Security] Applied T-38-05 hard cap on getTopUncategorizedExpenses limit**
- The plan listed T-38-05 as a threat to mitigate
- Implemented `Math.min(limit, 100)` inside the function body
- Files modified: lib/dal/transactions.ts
- This is the mitigation specified in the threat register

### Pre-existing Issues (out of scope)

- `tests/production-smoke.test.ts` and `tests/set-r2-cors.test.ts` have pre-existing TypeScript errors (`NODE_ENV` missing from ProcessEnv mock) — deferred, not introduced by this plan
- `app/(app)/prototype/onboarding/` files have Italian developer comments — pre-existing `check:language` failure, not introduced by this plan

## Known Stubs

None. All functions query real data. `formatMonthRange` outputs real Intl.DateTimeFormat values. The layout guard makes a live DB call via `getTransactionCount`.

## Threat Flags

No new threat surface beyond what the plan's threat model documents (T-38-01 through T-38-05 all mitigated as planned).

## Self-Check: PASSED

All key files found:
- lib/dal/transactions.ts — FOUND
- lib/dal/imports.ts — FOUND
- lib/utils/date.ts — FOUND
- lib/routes.ts — FOUND
- app/(app)/layout.tsx — FOUND
- tests/transactions-dal.test.ts — FOUND
- tests/imports-dal.test.ts — FOUND
- tests/date-utils.test.ts — FOUND
- tests/app-layout-guard.test.ts — FOUND

All commits found:
- 6f43e62 — test RED getTransactionCount/getTopUncategorizedExpenses
- 315f751 — feat GREEN getTransactionCount/getTopUncategorizedExpenses
- de7645f — test RED getFileCoveredMonths/formatMonthRange
- d3ebed7 — feat GREEN getFileCoveredMonths/formatMonthRange
- 28cf163 — test RED RSC layout guard
- 8c0423c — feat GREEN onboarding route + proxy + layout guard
