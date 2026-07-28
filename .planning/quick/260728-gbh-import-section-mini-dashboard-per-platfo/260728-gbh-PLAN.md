---
phase: quick-260728-gbh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/dal/transactions.ts
  - lib/utils/date.ts
  - tests/transactions-dal.test.ts
  - tests/date-utils.test.ts
  - components/import/platform-year-coverage.tsx
  - "app/(app)/import/page.tsx"
  - tests/platform-year-coverage.test.tsx
autonomous: true
requirements: [GBH-01]

must_haves:
  truths:
    - "On /import, above the files table, the user sees one row per platform that has at least one transaction in the current calendar year, each showing a range bar and a humanized Italian date label (e.g. '1 gen – 30 apr')."
    - "A platform's bar position reflects where its first and last current-year transactions fall on the Jan 1 -> Dec 31 timeline, so a platform imported through July visibly extends further right than one imported only through April."
    - "Platforms with zero transactions in the current year never appear in this section."
    - "When no platform has any current-year transaction, the whole section renders nothing (no empty card, no heading)."
  artifacts:
    - "lib/dal/transactions.ts exports getPlatformYearCoverage(year) and PlatformYearCoverageRow"
    - "lib/utils/date.ts exports yearProgressPercent(date, year) and formatDayMonthRange(start, end)"
    - "components/import/platform-year-coverage.tsx exports PlatformYearCoverageSection"
  key_links:
    - "app/(app)/import/page.tsx calls getPlatformYearCoverage(currentYear) and renders <PlatformYearCoverageSection> above FilesToolbar"
    - "PlatformYearCoverageSection -> yearProgressPercent/formatDayMonthRange (lib/utils/date.ts) for bar geometry and labels"
    - "getPlatformYearCoverage joins transaction -> file -> importFormatVersion -> platform, the same ownership-scoped chain as the existing getTransactionPlatforms"
---

<objective>
Add a small "coverage" dashboard to the top of the Import section (`/import`): one row per platform with at least one transaction in the current calendar year, rendered as a Jan-Dec range bar (filled from the platform's earliest to latest current-year transaction date) plus a humanized Italian date label. Lets the user spot at a glance which platforms are behind on import (e.g. Fineco stopping at the end of April) versus which are current (e.g. Trade Republic through the end of July).

Purpose: today the only way to see "how far along" each platform's import is requires opening the filter/table and reading raw dates per file. A single glanceable strip answers "who's behind?" without any interaction.

Output: a new DAL query (`getPlatformYearCoverage`), two small date-utility helpers, a new presentational component, and its wiring into the existing `/import` page — no new tables, no new Server Action, no charting dependency.
</objective>

<execution_context>
@$HOME/.cursor/gsd-core/workflows/execute-plan.md
@$HOME/.cursor/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CONTEXT.md
@lib/dal/transactions.ts
@lib/utils/date.ts
@app/(app)/import/page.tsx
@components/ui/card.tsx
@components/dashboard/overview/kpi-card-reading.tsx

**Locked decisions (do not revisit):** placement = top of `/import`, above the files table (existing `<FilesToolbar>`/`<ImportTable>` section is untouched); scope = current calendar year only, no year picker; bar = range coverage (MIN..MAX transaction date within the year), not a "percent complete" fill from zero; empty platforms (zero current-year transactions) are omitted, never shown empty; no charting library — plain CSS bar (absolute-positioned fill inside a relative track), same visual family as the dashboard's existing `CompositionBar` (`kpi-card-reading.tsx`) but a *range* fill instead of a stacked proportion fill; layers respected — DAL query in `lib/dal/`, no new Server Action (RSC data fetch), presentational component under `components/`.

**Existing precedent to mirror exactly:** `getTransactionPlatforms` (`lib/dal/transactions.ts`) already joins `transaction -> file (aliased importFile) -> importFormatVersion -> platform`, scoped by `and(eq(transaction.userId, userId), eq(importFile.userId, userId))`. The new query reuses the identical join chain and ownership guard, adding a year-bounded `gte`/`lte` on `transaction.occurredAt` and a `GROUP BY platform.id, platform.name` with `MIN`/`MAX(transaction.occurredAt)`.

**Sort order (Claude's discretion, resolved):** most-behind-first — `ORDER BY MAX(occurredAt) ASC, platform.name ASC`. The point of the feature is spotting which platform needs attention; putting the platform with the oldest "last transaction" at the top surfaces that immediately instead of requiring the user to scan every row.

**Label format (locked example, verbatim):** `"1 gen – 30 apr"` — day number + lowercase Italian short month (Intl's `it-IT` `month: 'short'` already lowercases, e.g. "gen", "apr" — verified, no capitalization step needed, unlike the existing `formatMonthRange` which deliberately capitalizes for its own "Mag 2026" style), en-dash `–` with a space on each side, no year (the section header/context already scopes to the current year).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Platform year-coverage DAL query + date-range helpers</name>
  <files>lib/dal/transactions.ts, lib/utils/date.ts, tests/transactions-dal.test.ts, tests/date-utils.test.ts</files>
  <behavior>
    - `yearProgressPercent(date, year)`: Jan 1 of `year` -> 0, Dec 31 23:59:59.999 of `year` -> 100, a mid-year date -> a value strictly between 0 and 100; a date before Jan 1 or after Dec 31 of `year` is clamped to 0/100 (never negative, never > 100).
    - `formatDayMonthRange(start, end)`: `(new Date(2026,0,1), new Date(2026,3,30))` -> `"1 gen – 30 apr"`; same-day start/end -> `"30 apr – 30 apr"` (no dedup — callers decide whether to collapse a single-day range, this helper only formats).
    - `getPlatformYearCoverage(2026)`: calls `verifySession()`; queries with the same 4-table join chain as `getTransactionPlatforms` (`transaction` -> `file` as `importFile` -> `importFormatVersion` -> `platform`); `WHERE` scopes ownership on both `transaction.userId` and `importFile.userId` AND bounds `transaction.occurredAt` to `[new Date(2026,0,1), new Date(2026,11,31,23,59,59,999)]`; `GROUP BY platform.id, platform.name`; returns `{ platformId, platformName, firstTransactionAt, lastTransactionAt }[]` ordered by `MAX(occurredAt)` ascending then platform name ascending (most-behind platform first). A platform with zero rows in that year window never appears (inner joins + the date `WHERE` naturally exclude it — no extra filtering needed).
  </behavior>
  <action>
    In `lib/utils/date.ts`, add two exported pure functions (no new imports needed — reuse the file's existing `Intl.DateTimeFormat` approach, see `formatMonthShort`/`formatMonthRange` for the established style):
    - `yearProgressPercent(date: Date, year: number): number` — computes `start = new Date(year, 0, 1).getTime()`, `end = new Date(year, 11, 31, 23, 59, 59, 999).getTime()`, clamps `date.getTime()` into `[start, end]`, returns `((clamped - start) / (end - start)) * 100`.
    - `formatDayMonthRange(start: Date, end: Date, locale = 'it-IT'): string` — formats each side as `${date.getDate()} ${shortMonth}` where `shortMonth` is `new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)` with a defensive `.replace(/\.$/, '')` (matching the existing `formatMonthShort` defensive strip, in case a runtime's ICU data appends a trailing dot) — deliberately do NOT capitalize (unlike `formatMonthShort`, which capitalizes for its "Mag 2026" style; the locked label example is fully lowercase: "1 gen"). Join both sides with `' – '` (en-dash, space on each side).

    In `lib/dal/transactions.ts`, add (near `getTransactionPlatforms`, reusing its exact import set — `gte`/`lte`/`sql`/`asc`/`and`/`eq` are already imported, no new drizzle-orm imports needed):
    - `export type PlatformYearCoverageRow = { platformId: number; platformName: string; firstTransactionAt: Date; lastTransactionAt: Date }`
    - `export const getPlatformYearCoverage = cache(async (year: number): Promise<PlatformYearCoverageRow[]> => { ... })` — calls `verifySession()`, builds `from = new Date(year, 0, 1)` / `to = new Date(year, 11, 31, 23, 59, 59, 999)`, selects `{ platformId: platform.id, platformName: platform.name, firstTransactionAt: sql<Date>\`min(${transaction.occurredAt})\`, lastTransactionAt: sql<Date>\`max(${transaction.occurredAt})\` }` from `transaction`, `.innerJoin(importFile, eq(transaction.fileId, importFile.id))`, `.innerJoin(importFormatVersion, eq(importFile.importFormatVersionId, importFormatVersion.id))`, `.innerJoin(platform, eq(importFormatVersion.platformId, platform.id))`, `.where(and(eq(transaction.userId, userId), eq(importFile.userId, userId), gte(transaction.occurredAt, from), lte(transaction.occurredAt, to)))`, `.groupBy(platform.id, platform.name)`, `.orderBy(asc(sql\`max(${transaction.occurredAt})\`), asc(platform.name))`. Map raw rows so `firstTransactionAt`/`lastTransactionAt` are real `Date` instances (some pg drivers return timestamp aggregates as strings — mirror the existing `instanceof Date ? x : new Date(x)` guard already used in `getFileCoveredMonths`).

    Write the tests FIRST (RED), confirm they fail against the current (unimplemented) exports, then implement (GREEN):
    - `tests/date-utils.test.ts`: new `describe('yearProgressPercent', ...)` covering the four behavior bullets above (0 at Jan 1, 100 at Dec 31 23:59:59.999, mid-year strictly between, clamping for out-of-year dates). New `describe('formatDayMonthRange', ...)` covering the `"1 gen – 30 apr"` case and the same-day case.
    - `tests/transactions-dal.test.ts`: extend the shared `makeQueryChain` helper (top of file) with a `groupBy: vi.fn(() => chain)` method (mirrors the existing `orderBy` shape) so it supports the new query's `.groupBy().orderBy()` tail. Add a `describe('getPlatformYearCoverage', ...)` block (near the existing `getTransactionPlatforms` tests) asserting: `verifySession` is called; the selected shape includes `platformId`/`platformName`/`firstTransactionAt`/`lastTransactionAt` keys; `.innerJoin` is called 3 times (importFile, importFormatVersion, platform) — reuse the existing `expect(chain.innerJoin).toHaveBeenNthCalledWith(...)` assertion style already used for `getTransactionPlatforms`; the `where` arg includes both ownership `eq` conditions plus `gte`/`lte` on `transaction.occurredAt` for the given year's Jan 1 / Dec 31 boundaries (mirror the existing year-boundary assertion style used elsewhere in this file for date-bounded queries); `.groupBy` is called.
  </action>
  <verify>
    <automated>yarn vitest run tests/date-utils.test.ts tests/transactions-dal.test.ts</automated>
  </verify>
  <done>yearProgressPercent and formatDayMonthRange exist in lib/utils/date.ts with passing tests for the behaviors listed above; getPlatformYearCoverage exists in lib/dal/transactions.ts, reuses the getTransactionPlatforms join/ownership pattern plus a year-bounded WHERE and GROUP BY, and has passing tests asserting the join chain, ownership scoping, and date bounds.</done>
</task>

<task type="auto">
  <name>Task 2: PlatformYearCoverageSection component + /import page wiring</name>
  <files>components/import/platform-year-coverage.tsx, app/(app)/import/page.tsx, tests/platform-year-coverage.test.tsx</files>
  <action>
    Create `components/import/platform-year-coverage.tsx` (server component, no `'use client'` needed — no interactivity) exporting `PlatformYearCoverageSection({ coverage, year }: { coverage: PlatformYearCoverageRow[]; year: number })` (import `PlatformYearCoverageRow` type from `@/lib/dal/transactions`):
    - Returns `null` immediately when `coverage.length === 0` (locked decision 4 — omit entirely, never render an empty card).
    - Otherwise renders a `Card` (`@/components/ui/card`) with a `CardHeader`/`CardTitle` reading `Copertura {year} per piattaforma` and a `CardContent` listing one row per `coverage` entry (already ordered by the DAL query — do not re-sort). Each row: platform name label (truncated, fixed width e.g. `w-28 md:w-36 shrink-0 truncate text-sm`), a track (`relative h-2 flex-1 overflow-hidden rounded-full bg-muted`) containing one absolutely-positioned fill div (`absolute inset-y-0 rounded-full bg-primary`) with inline `style={{ left: '{start}%', width: '{width}%' }}` where `start = yearProgressPercent(row.firstTransactionAt, year)` and `width = Math.max(yearProgressPercent(row.lastTransactionAt, year) - start, 1.5)` (the `Math.max(..., 1.5)` floor keeps a single-day-only platform visible instead of collapsing to a 0px sliver), and a trailing date-range label (`w-28 md:w-36 shrink-0 text-right text-xs text-muted-foreground tabular-nums`) from `formatDayMonthRange(row.firstTransactionAt, row.lastTransactionAt)`. Import both helpers from `@/lib/utils/date`. Use `row.platformId` as the React key.

    Wire it into `app/(app)/import/page.tsx`: import `getPlatformYearCoverage` from `@/lib/dal/transactions` (co-located with `getTransactionPlatforms`, which the page already imports from there) and `PlatformYearCoverageSection` from `@/components/import/platform-year-coverage`. Compute `const currentYear = new Date().getFullYear()` once. Add `getPlatformYearCoverage(currentYear)` as a third entry in the existing `Promise.all([getTransactionPlatforms(), getMonthsWithData('files')])` call (rename the destructured result accordingly, e.g. `const [platforms, monthsWithData, platformYearCoverage] = await Promise.all([...])`). Render `<PlatformYearCoverageSection coverage={platformYearCoverage} year={currentYear} />` as the first child inside the page's outer `flex flex-col gap-6` wrapper, directly after the header row (title + `<ImportUploadDialog />`) and before the `<section>` that holds `<FilesToolbar>`/`<ImportTable>`/`<EmptyState>` — i.e. above the files table per the locked placement decision, not inside that section.

    Create `tests/platform-year-coverage.test.tsx` using `react-dom/server`'s `renderToStaticMarkup` directly against the component (no mocking needed — it has no hooks, no `next/navigation`, no client-only primitives; `Card`/`CardHeader`/`CardTitle`/`CardContent` are plain server-renderable divs). Assert: given 2 coverage rows, the platform names and both formatted range labels (e.g. `"1 gen – 30 apr"`, `"1 gen – 30 lug"`) appear in the markup, and there are 2 fill-bar elements with distinct inline `left`/`width` styles reflecting the two different date ranges (assert the numeric percentages via a regex on the rendered `style` attribute, or via a data attribute if easier to assert than parsing inline `style` strings). Given `coverage: []`, assert the render returns an empty string / no `Copertura` heading text (covers the "nothing rendered" truth).
  </action>
  <verify>
    <automated>yarn vitest run tests/platform-year-coverage.test.tsx && npx tsc --noEmit && yarn check:language</automated>
  </verify>
  <done>PlatformYearCoverageSection renders one bar+label row per platform (ordered most-behind-first from the DAL), renders nothing when coverage is empty; /import wires getPlatformYearCoverage(currentYear) into the existing Promise.all and renders the section above the files table; new component test passes; tsc and check:language are clean on touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| Authenticated user → getPlatformYearCoverage | New read-only DAL query; no new input surface (the only parameter, `year`, is server-derived from `new Date().getFullYear()`, never taken from a request param in this plan). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260728gbh-01 | Information Disclosure | lib/dal/transactions.ts (getPlatformYearCoverage) | low | accept | Scoped via `verifySession()` plus ownership `eq` conditions on both `transaction.userId` and `importFile.userId`, identical to the pre-existing `getTransactionPlatforms` — no new access path, just an additional aggregate over already-user-scoped rows. |
| T-260728gbh-02 | Tampering | app/(app)/import/page.tsx | low | accept | `year` is computed server-side (`new Date().getFullYear()`), never read from `searchParams` or any client input in this plan — no injectable value reaches the query. |
</threat_model>

<verification>
1. `yarn vitest run tests/date-utils.test.ts tests/transactions-dal.test.ts tests/platform-year-coverage.test.tsx` — all pass, no regressions in the shared `makeQueryChain` mock used by other `getTransactions*`/`getTransactionPlatforms` tests in `tests/transactions-dal.test.ts`.
2. `yarn vitest run` (full suite) — green, confirming the `makeQueryChain` extension (added `groupBy`) does not break any pre-existing test in that file.
3. `npx tsc --noEmit` — clean.
4. `yarn check:language` — clean (the one new UI string, "Copertura {year} per piattaforma", is intentional Italian product copy; all identifiers/comments are English).
5. Manual: visit `/import` with at least two platforms imported at different current-year cutoffs (e.g. one platform through April, one through July) — confirm the second platform's bar visibly extends further right, the most-behind platform sorts first, and a platform with zero current-year transactions does not appear. Visit `/import` as a user with zero current-year transactions across all platforms — confirm no empty coverage card renders above the (existing) empty-state files list.
</verification>

<success_criteria>
- `getPlatformYearCoverage(year)` returns one row per platform with ≥1 transaction in that calendar year, with correct MIN/MAX date bounds, ownership-scoped, most-behind-first ordering.
- `yearProgressPercent`/`formatDayMonthRange` are pure, tested, and produce the locked label format ("1 gen – 30 apr").
- `/import` renders the coverage section above the files table when data exists, and renders nothing when it doesn't.
- All new/touched tests pass; full suite stays green; tsc and check:language clean.
</success_criteria>

<output>
Create `.planning/quick/260728-gbh-import-section-mini-dashboard-per-platfo/260728-gbh-SUMMARY.md` when done
</output>
