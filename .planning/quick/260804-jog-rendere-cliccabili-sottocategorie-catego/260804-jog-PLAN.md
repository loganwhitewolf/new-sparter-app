---
phase: 260804-jog
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/utils/search-params.ts
  - components/transactions/transactions-back-link.tsx
  - app/(app)/transactions/page.tsx
  - tests/table-search-params.test.ts
  - tests/transactions-back-link.test.tsx
  - lib/routes.ts
  - components/dashboard/category-subcategory-breakdown.tsx
  - app/(app)/dashboard/categories/[id]/page.tsx
  - tests/category-subcategory-breakdown.test.tsx
  - components/dashboard/category-top-transactions.tsx
  - tests/category-detail-components.test.tsx
autonomous: true
requirements:
  - NAV-01
  - NAV-02
  - NAV-03
  - NAV-04
  - NAV-05

estimate:
  tokens: 105000
  raw_tokens: 82000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "Clicking a subcategory row on /dashboard/categories/[id] navigates to /transactions pre-filtered to that subcategory + its parent category + all 12 months of the year currently viewed on the detail page (NAV-01)."
    - "Clicking one of the top-5 transaction cards on /dashboard/categories/[id] navigates to that transaction's own /transactions/[id] detail page (NAV-02)."
    - "On /transactions, when a valid `?back=` deep-link param is present, an explicit 'Torna indietro' affordance renders; clicking it prefers real in-app browser history (router.back(), preserving the origin page's own state) and falls back to a real navigation to the validated return URL only when no such history exists (NAV-03)."
    - "On /transactions/[id], the pre-existing DetailPageShell smart-back mechanism already returns the user to the category detail page they came from via router.back() — verified by inspection/existing tests, not re-implemented (NAV-04)."
    - "An invalid or foreign `back` value (anything not starting with the literal `/dashboard/categories/` prefix — an absolute URL, a protocol-relative `//host`, a foreign in-app path) is silently dropped: no back affordance renders, no open redirect is possible."
    - "A row with presence 'current-only' (no prior-year movements) shows a compact 'nuova' badge next to its name instead of the inline '— nuova nel {year}' sentence; hovering/focusing the badge reveals a tooltip reading 'questa spesa compare per la prima volta nel {year}' (NAV-05). The 'previous-only' -> '— solo nel {year - 1}' suffix stays untouched."
  artifacts:
    - "lib/utils/search-params.ts — parseTransactionsBackParam(value): string | undefined, a total function accepting only /dashboard/categories/-prefixed paths"
    - "components/transactions/transactions-back-link.tsx — new client component, TransactionsBackLink({ backHref }), mirrors DetailPageShell's smart-back click handler"
    - "app/(app)/transactions/page.tsx — reads/validates ?back=, conditionally renders TransactionsBackLink as the page's first child"
    - "lib/routes.ts — transactionsBySubcategoryHref(subCategoryId, categorySlug, year, backHref): string"
    - "components/dashboard/category-subcategory-breakdown.tsx — new optional categorySlug/backHref props gate a real <Link> on each subcategory row name, falling back to today's plain text when either is absent"
    - "components/dashboard/category-top-transactions.tsx — each top-5 card is a real <Link> to transactionDetailHref(transaction.id)"
    - "app/(app)/dashboard/categories/[id]/page.tsx — threads lens into CategoryDetailContent; computes categoryDetailOwnHref from data already in scope and passes it + data.category.slug into CategorySubcategoryBreakdown"
  key_links:
    - "transactionsBySubcategoryHref(...) embeds this SAME detail page's own href (via buildDashboardCategoryDetailHref) as the back param -> parseTransactionsBackParam validates the identical /dashboard/categories/ prefix on the receiving end -> TransactionsBackLink renders only when that round trip succeeds end-to-end"
    - "CategorySubcategoryBreakdown's Link -> the ALREADY-SHIPPED parseTransactionFilters (subCategoryId/categorySlug/months) and the transactions toolbar's existing subCategory/category/months chips -> zero new filtering logic, one reused contract"
    - "CategoryTopTransactions' Link -> transactionDetailHref -> the ALREADY-SHIPPED DetailPageShell hasInAppHistory/attachPopstateRefresh smart-back -> returns to the category detail page with zero new code on that side"
    - "presenceSuffix's 'current-only' branch -> the new Badge+Tooltip markup in CategorySubcategoryBreakdown -> tests/category-subcategory-breakdown.test.tsx's updated assertion, replacing the old literal-string 'nuova nel 2026' check"
---

<objective>
Make two read-only surfaces on the category detail page (`/dashboard/categories/[id]`) clickable, each
landing on an existing page pre-filtered/scoped correctly, with a working way back in both directions:

1. Each row in the subcategory breakdown table navigates to `/transactions`, pre-filtered to that
   subcategory + its parent category + the full year currently displayed on the detail page.
2. Each of the "top 5 transazioni" cards navigates to that transaction's own `/transactions/[id]`
   detail page.

Purpose: today both surfaces are read-only dead ends — a user who spots a big subcategory number or a
notable top transaction has no way to drill into the underlying movements without manually re-filtering
the transactions table from scratch.

Output: a validated `?back=` deep-link contract on `/transactions` (a same-origin-only prefix
allowlist, never an open redirect) with an explicit "Torna indietro" affordance that prefers real
browser/router history and falls back to the validated URL only when none exists; a new
`transactionsBySubcategoryHref` route builder reusing the transactions page's existing filter/sort URL
contract verbatim; both card/row surfaces wired to real `<Link>`s.

**Locked decisions (this plan — no separate `*-CONTEXT.md`; this quick task skipped discuss-phase, so
these are recorded here instead):**

- **D-01 (NAV-01).** The subcategory click-through carries the subcategory id + parent category slug +
  all 12 months of the **year currently viewed** on the category detail page (the page's own `?year=`,
  which defaults to — but is not always — today's calendar year via the existing `CategoryYearSelect`).
  It reuses the transactions page's existing `subCategory`/`category`/`months` URL filter contract
  verbatim (`lib/validations/transactions.ts`'s `parseTransactionFilters`, already shipped, untouched by
  this plan) — no parallel filtering mechanism.
- **D-02 (NAV-03).** Back-navigation to the transactions list is NOT a new global history/breadcrumb
  system. It is a single `?back=` query param carrying the originating category detail page's own href,
  validated on read by a strict same-route prefix allowlist (`/dashboard/categories/`) before it is ever
  trusted as a navigation target — the only legitimate return route this feature produces.
- **D-03 (NAV-03).** The PRIMARY back mechanism is genuine browser/router history
  (`router.back()` when `window.history.length > 1`), exactly the algorithm
  `components/detail-pages/detail-page-shell.tsx`'s `DetailPageShell` already ships (`hasInAppHistory` +
  `attachPopstateRefresh`, both already exported for reuse). The `?back=` URL is only the FALLBACK target
  for a fresh tab / directly-opened link with no in-app history — the common case (a real click-through)
  never touches it.
- **D-04 (NAV-02/NAV-04).** Top-5 transaction cards link straight to the existing `/transactions/[id]`
  detail page. Its `DetailPageShell`-based smart-back mechanism is untouched and already correct here:
  a client-side `<Link>` navigation pushes browser history, so "Indietro" on the transaction detail page
  already calls `router.back()` back to the category detail page. This plan verifies that, it does not
  re-implement it.
- **D-05.** Row/card click-target shape follows existing sibling precedent rather than inventing a new
  interaction style: the subcategory table row links only its name cell (matching
  `components/dashboard/category-ranking-list.tsx`'s row-link pattern — a real `<table>` cannot nest an
  `<a>` around a `<tr>`); the top-5 transaction card wraps its ENTIRE `<li>` content in one `<Link>`
  (matching that same file's `<li>`-based card-list precedent, since it is not a `<table>`).
- A `presence: 'previous-only'` subcategory row (a subcategory with zero movements in the currently
  viewed year) stays a real link — it correctly resolves to an empty result set for that year, which is
  a legitimate, already-handled transactions-page empty state, not a special case to disable.
- **D-06 (NAV-05, added mid-session).** The existing inline `— nuova nel {year}` sentence next to a
  `current-only` row's name is visual clutter competing with the new clickable-row affordance above. It
  is replaced with a compact `Badge` reading "nuova" plus a `Tooltip` (both pre-existing UI primitives,
  no new dependency) carrying the fuller sentence "questa spesa compare per la prima volta nel {year}".
  The sibling `previous-only` -> `— solo nel {year - 1}` suffix is explicitly out of scope and untouched.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@CONTEXT.md
@app/(app)/dashboard/categories/[id]/page.tsx
@components/dashboard/category-subcategory-breakdown.tsx
@components/dashboard/category-top-transactions.tsx
@app/(app)/transactions/page.tsx
@components/detail-pages/detail-page-shell.tsx
@components/transactions/transaction-detail-client.tsx
@lib/routes.ts
@lib/utils/search-params.ts
@lib/validations/transactions.ts
@tests/table-search-params.test.ts
@tests/category-subcategory-breakdown.test.tsx
@tests/category-detail-components.test.tsx
@tests/category-ranking-list.test.tsx
@tests/detail-page-shell.test.tsx

**Not touched by this plan** (verified by reading): `lib/dal/transactions.ts` (subCategoryId/categorySlug
filters already exist and are already userId-scoped — no DAL change needed); `lib/validations/transactions.ts`
(parseTransactionFilters already parses `subCategory`/`category`/`months`); `app/(app)/transactions/transactions.table.ts`
(the `subCategory`/`category` toolbar filter fields already exist); `components/transactions/transaction-detail-client.tsx`
and `components/detail-pages/detail-page-shell.tsx` (NAV-04's smart-back already works, verified not modified).
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Validated back-navigation affordance on /transactions</name>
  <files>lib/utils/search-params.ts, components/transactions/transactions-back-link.tsx, app/(app)/transactions/page.tsx, tests/table-search-params.test.ts, tests/transactions-back-link.test.tsx</files>
  <action>
    Build the receiving end of the back-navigation contract FIRST (interface-first ordering) — Task 2
    only ever produces a `?back=` value, it never has to know how that value is validated or rendered.

    1. In `lib/utils/search-params.ts`, add — near the existing `parseLensParam`/`extractLensPassthrough`
       pair, following this file's own "total function, never throws" convention and JSDoc style — a
       module constant `DASHBOARD_CATEGORY_DETAIL_BACK_PREFIX = '/dashboard/categories/'` and an exported
       function `parseTransactionsBackParam(value: string | string[] | undefined): string | undefined`.
       Reuse the file's existing private `firstTrimmed` helper exactly like every other parser in this
       file, then return the trimmed value UNCHANGED only when it starts with the literal
       `DASHBOARD_CATEGORY_DETAIL_BACK_PREFIX`; return `undefined` for everything else (absent, empty, an
       array whose first element doesn't match, an absolute URL, a protocol-relative `//host` string, or
       any path under a different route). Document inline that this is D-02's open-redirect hardening:
       the value is client-reflected, untrusted input used to construct a same-tab navigation target, so
       only the one legitimate return route this feature ever produces is trusted — nothing here can ever
       resolve to an external host.

    2. Create `components/transactions/transactions-back-link.tsx` as a new `'use client'` component
       exporting `TransactionsBackLink({ backHref }: { backHref: string })`. Import `hasInAppHistory` and
       `attachPopstateRefresh` from `@/components/detail-pages/detail-page-shell` (both already exported
       there for reuse — do not modify that file), `useRouter` from `next/navigation`, `ArrowLeft` from
       `lucide-react`, and `MouseEvent` as a type from `react`. Implement the SAME smart-back click
       handler `DetailPageShell` already carries (D-03), locally — this is a deliberate small duplication
       to keep this plan's footprint to net-new/small files rather than refactoring the shared shell:
       on click, call `preventDefault()`; if `window` is `undefined`, `router.push(backHref)` and return;
       else if `!hasInAppHistory(window.history.length)`, `router.push(backHref)`; otherwise call
       `attachPopstateRefresh(window, () => router.refresh())` then `router.back()`. Render a real
       `<a href={backHref} onClick={handleClick}>` — never a `<button>`, so SSR/no-JS clients still
       degrade to a normal navigable link, mirroring `DetailPageShell`'s own documented rationale —
       containing the `ArrowLeft` icon (`h-4 w-4`) and the literal text "Torna indietro", styled
       `inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground`
       (byte-identical classNames to `DetailPageShell`'s own back link, for visual consistency).

    3. In `app/(app)/transactions/page.tsx`: import `parseTransactionsBackParam` from
       `@/lib/utils/search-params` and `TransactionsBackLink` from
       `@/components/transactions/transactions-back-link`. Inside `TransactionsPage`, immediately after
       `const params = await searchParams`, compute `const backHref = parseTransactionsBackParam(params.back)`.
       In the returned JSX, render `{backHref ? <TransactionsBackLink backHref={backHref} /> : null}` as
       the FIRST child of the outer `<div className="flex flex-col gap-6">`, before the existing
       title/toolbar row. Nothing else in this file changes — a normal `/transactions` visit (no `back`
       param) renders byte-identical to today.

    4. Extend `tests/table-search-params.test.ts` with a new `describe('parseTransactionsBackParam')`
       block, matching this file's existing per-parser test shape: a valid
       `/dashboard/categories/7?year=2026` value passes through unchanged; `undefined` and `''` return
       `undefined`; a foreign in-app path (`/expenses/1`) returns `undefined`; an absolute URL
       (`https://evil.com`) returns `undefined`; a protocol-relative value (`//evil.com`) returns
       `undefined`; array input uses first-element semantics (`['/dashboard/categories/7', '/expenses/1']`
       resolves via the first element); the function never throws on any input.

    5. Create `tests/transactions-back-link.test.tsx`, mocking `next/navigation` exactly like
       `tests/detail-page-shell.test.tsx` does (`vi.mock('next/navigation', () => ({ useRouter: () =>
       ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }))`). Via `renderToStaticMarkup`, assert that
       rendering `<TransactionsBackLink backHref="/dashboard/categories/7?year=2026" />` produces markup
       containing `href="/dashboard/categories/7?year=2026"` and the literal text "Torna indietro".
  </action>
  <verify>
    <automated>node_modules/.bin/vitest run tests/table-search-params.test.ts tests/transactions-back-link.test.tsx</automated>
  </verify>
  <done>parseTransactionsBackParam only ever returns a value starting with the literal /dashboard/categories/ prefix and never throws; TransactionsBackLink renders a real navigable &lt;a&gt; wired to the same smart-back algorithm DetailPageShell uses; /transactions shows the back affordance only when a valid back param is present and is otherwise unchanged; both test files pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Subcategory rows navigate to the filtered transactions table (NAV-01/D-01)</name>
  <files>lib/routes.ts, components/dashboard/category-subcategory-breakdown.tsx, app/(app)/dashboard/categories/[id]/page.tsx, tests/category-subcategory-breakdown.test.tsx</files>
  <behavior>
    - transactionsBySubcategoryHref(4, 'alimentari-e-ristorazione', 2026, '/dashboard/categories/7?year=2026') returns a /transactions href whose query string, once re-parsed, has subCategory=4, category=alimentari-e-ristorazione, months equal to the comma-joined list of all twelve 2026-01..2026-12 tokens, and back equal (after decoding) to /dashboard/categories/7?year=2026.
    - With categorySlug and backHref both provided, CategorySubcategoryBreakdown renders each row's name as a real <a> built from that exact function's output — including for a presence: 'previous-only' row.
    - With either categorySlug or backHref omitted, every row renders the pre-existing plain <span> — zero <a> elements — byte-identical to today.
  </behavior>
  <action>
    1. In `lib/routes.ts`, add `transactionsBySubcategoryHref(subCategoryId: number, categorySlug: string,
       year: number, backHref: string): string` directly below the existing `transactionsByTagHref`,
       documented with this file's same JSDoc-comment style (cite NAV-01/D-01). Internally build the
       `months` value as the comma-joined list of all twelve zero-padded `${year}-01`..`${year}-12`
       tokens (an intentionally separate small helper local to this export — do not import the private
       `buildMonthsParam` already duplicated in `components/dashboard/overview/overview-nudge.tsx`, this
       plan does not touch that file), then construct the query string via
       `new URLSearchParams({ subCategory: String(subCategoryId), category: categorySlug, months, back: backHref })`
       — using `URLSearchParams` (not manual string concatenation) is what correctly percent-encodes the
       nested `back` URL — and return `${APP_ROUTES.transactions}?${params.toString()}`.

    2. In `components/dashboard/category-subcategory-breakdown.tsx`: add two new optional props to
       `Props` — `categorySlug?: string` and `backHref?: string` — with a one-line doc comment explaining
       both must be present for a row to become a link (D-01): the parent category's own detail-page href
       cannot be reconstructed from a subcategory row alone. Import `Link` from `next/link` and
       `transactionsBySubcategoryHref` from `@/lib/routes`. In the row-rendering map, replace the existing
       `<span className="truncate" title={row.name}>{row.name}</span>` with: when both `categorySlug` and
       `backHref` are truthy, `<Link href={transactionsBySubcategoryHref(row.id, categorySlug, year,
       backHref)} className="truncate underline-offset-2 hover:underline focus-visible:outline-none
       focus-visible:ring-2 focus-visible:ring-ring rounded-sm" title={row.name}>{row.name}</Link>`;
       otherwise the exact original `<span>` unchanged. The row's existing `isGone`/muted-text styling for
       `presence === 'previous-only'` stays untouched — only the name cell's element changes.

    3. In `app/(app)/dashboard/categories/[id]/page.tsx`: add `import type { LensPassthrough } from
       '@/lib/utils/search-params'` and change the `@/lib/routes` import to also bring in
       `buildDashboardCategoryDetailHref` alongside the existing `buildDashboardCategoriesHref`. Thread
       `lens` into `CategoryDetailContent` — add `lens?: LensPassthrough` to its inline prop-destructuring
       type and pass `lens={lens}` at its JSX call site (`<CategoryDetailContent categoryId={categoryId}
       year={year} view={view} lens={lens} />`). Inside `CategoryDetailContent`, after `const data = await
       getCategoryDetailYearWindow(...)`, compute `const categoryDetailOwnHref = data.category ?
       buildDashboardCategoryDetailHref(data.category.id, { year, type: data.category.type, lens }) :
       undefined`, then pass `categorySlug={data.category?.slug} backHref={categoryDetailOwnHref}` into
       the existing `<CategorySubcategoryBreakdown>` call site alongside its current
       `contributions`/`year`/`type` props.

    4. Extend `tests/category-subcategory-breakdown.test.tsx`: add a `vi.mock('next/link', () => ({
       default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (<a href={String(href)}
       {...props}>{children}</a>) }))` at the top of the file (matching
       `tests/category-ranking-list.test.tsx`'s own mock verbatim, including its `import type * as React
       from 'react'`), then switch the file's `CategorySubcategoryBreakdown` import to the post-mock
       `const { CategorySubcategoryBreakdown } = await import('@/components/dashboard/category-subcategory-breakdown')`
       pattern that same file uses. Add three tests: (a) with `categorySlug="alimentari-e-ristorazione"`
       and `backHref="/dashboard/categories/7?year=2026"` passed, the rendered markup contains an `href`
       attribute equal to `transactionsBySubcategoryHref(1, 'alimentari-e-ristorazione', 2026,
       '/dashboard/categories/7?year=2026')`'s own real return value for the fixture's first row (id `1`)
       — import and call the real function to build the expected string, never a hand-written literal, so
       the test cannot silently drift from the real encoding; (b) with `categorySlug`/`backHref` both
       omitted (today's existing call signature), the rendered markup contains zero `<a` elements; (c)
       with both props provided, the `presence: 'previous-only'` row ("Mensa aziendale", fixture id `5`)
       STILL renders a real `<a href=...>` — not skipped, not disabled.
  </action>
  <verify>
    <automated>node_modules/.bin/vitest run tests/category-subcategory-breakdown.test.tsx</automated>
  </verify>
  <done>transactionsBySubcategoryHref builds the exact subCategory+category+months+back query contract via URLSearchParams; CategorySubcategoryBreakdown's subcategory names are real links only when categorySlug+backHref are both provided (including previous-only rows), falling back to today's plain text otherwise; the category detail page threads lens through and computes its own return href from data already in scope; all new/updated assertions pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Top-5 transaction cards navigate to the transaction detail page (NAV-02/D-04)</name>
  <files>components/dashboard/category-top-transactions.tsx, tests/category-detail-components.test.tsx</files>
  <behavior>
    - Each of the (up to 5) rendered transaction cards is a real &lt;a href="/transactions/{id}"&gt; wrapping the ENTIRE card content (rank badge, title, description, date, amount) — not just the title text.
    - The zero-transactions empty-state branch renders unchanged: no &lt;a&gt;, no crash.
  </behavior>
  <action>
    1. In `components/dashboard/category-top-transactions.tsx`, import `Link` from `next/link` and
       `transactionDetailHref` from `@/lib/routes`. Replace the current
       `<li key={transaction.id} className="overflow-hidden rounded-xl border bg-card p-4 shadow-sm">`
       wrapper: make `<li key={transaction.id}>` bare (no className), and move the existing
       `overflow-hidden rounded-xl border bg-card p-4 shadow-sm` classes onto a new
       `<Link href={transactionDetailHref(transaction.id)}>` that replaces the current inner
       `<div className="flex items-center justify-between gap-4">` — keep that same flex layout on the
       `Link` itself: `className="flex items-center justify-between gap-4 overflow-hidden rounded-xl
       border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none
       focus-visible:ring-2 focus-visible:ring-ring"`. Every existing child (the rank-badge span, the
       title/description/date block, the amount paragraph) moves inside the `Link` unchanged — no
       content, formatting, or amount-tone logic changes anywhere in this file.

    2. Extend `tests/category-detail-components.test.tsx`: add the same `vi.mock('next/link', ...)`
       passthrough-anchor mock used in Task 2 (matching `tests/category-ranking-list.test.tsx`) at the top
       of the file, and switch this file's `CategoryTopTransactions` (and its sibling
       `CategoryDetailEmptyState`/`CategoryDetailSkeleton`) imports to the post-mock dynamic `await
       import(...)` pattern. Add one new test asserting the rendered markup for the file's existing
       `transactions` fixture contains `href="/transactions/tx-1"` and `href="/transactions/tx-2"` (build
       the expected strings via the real `transactionDetailHref`, never hand-written literals). Re-confirm
       (no assertion changes needed, just re-run) that the existing "limits top transactions to five
       rows" and "renders an explicit empty state for top transactions" tests still pass — the empty-state
       branch renders no `<a>` at all.
  </action>
  <verify>
    <automated>node_modules/.bin/vitest run tests/category-detail-components.test.tsx</automated>
  </verify>
  <done>Every rendered top-5 transaction card is a real link to its own /transactions/[id] detail page, wrapping the full card (not just the title); the empty state is unchanged. NAV-04 is satisfied by the pre-existing, unmodified DetailPageShell smart-back mechanism on that detail page (components/transactions/transaction-detail-client.tsx's backHref={APP_ROUTES.transactions} + hasInAppHistory), already covered by tests/detail-page-shell.test.tsx — verified by inspection, not re-implemented or re-tested here.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Replace inline "nuova nel {year}" suffix with a Badge + Tooltip (NAV-05/D-06)</name>
  <files>components/dashboard/category-subcategory-breakdown.tsx, tests/category-subcategory-breakdown.test.tsx</files>
  <behavior>
    - A row with presence 'current-only' renders a compact Badge reading exactly "nuova" next to its name (row/link name cell), not the old inline sentence.
    - That Badge is wrapped in the existing Tooltip primitives; the tooltip content is exactly "questa spesa compare per la prima volta nel {year}" (the actual year value, e.g. 2026).
    - A row with presence 'previous-only' is completely unaffected: it still renders its existing "— solo nel {year - 1}" muted-text suffix, no Badge, no Tooltip.
    - A row with presence 'both' (or whatever the neutral/no-suffix case is called) renders neither Badge nor suffix, unchanged.
  </behavior>
  <action>
    1. In `components/dashboard/category-subcategory-breakdown.tsx`, import `Badge` from `@/components/ui/badge`
       and `Tooltip`, `TooltipTrigger`, `TooltipContent` (and `TooltipProvider` if this codebase's usages wrap
       each instance individually — match whatever pattern `components/transactions/transaction-table.tsx` or
       `components/layout/sidebar.tsx` already uses verbatim, do not invent a new usage shape).
       Split `presenceSuffix(presence, year)` so the `current-only` branch no longer returns the inline
       sentence: either return `undefined`/an empty value for `current-only` from `presenceSuffix` and handle
       that case separately in the row markup, or introduce a small sibling helper (e.g. `isNewInYear(presence)`
       returning a boolean) — whichever keeps `presenceSuffix` a single, clearly-still-total function for the
       still-needed `previous-only` case. Leave the `previous-only` branch (`— solo nel ${year - 1}`) untouched.

    2. In the row-rendering map, immediately after the (now Link-or-span) name element from Task 2, render:
       when `presence === 'current-only'`, a `Tooltip`-wrapped `Badge` — `Badge` variant should match this
       codebase's existing small/muted badge usage (check `components/ui/badge.tsx`'s exported variants and
       pick the least visually loud one, e.g. `variant="secondary"` or `variant="outline"` — avoid a bold/
       destructive-looking variant that would read as an alert rather than an informational marker), with
       trigger content the literal text "nuova" and `TooltipContent` containing the literal string
       `` `questa spesa compare per la prima volta nel ${year}` ``. Keep the existing `previous-only` suffix
       `<span>` rendering exactly as today, in the same position, unaffected by this change.

    3. In `tests/category-subcategory-breakdown.test.tsx`, update the existing assertion(s) that currently
       check for the literal string `'nuova nel 2026'` (or similar) in rendered output: replace with an
       assertion that the row now renders the text "nuova" (the badge label) instead, and — if this test file's
       existing render setup already exercises Radix Tooltip open state elsewhere (check
       `tests/detail-page-shell.test.tsx`/other tooltip-consuming test files for the established pattern
       first) — assert the tooltip content text is present/reachable; if no existing pattern for asserting
       Radix tooltip open-content exists anywhere in this codebase's tests, it's acceptable to assert only
       that the `TooltipContent`/badge markup is present in the DOM (Radix commonly renders content
       server-side and toggles visibility via CSS/data-state, so a plain `getByText`/`querySelector` check for
       the tooltip's text content may already work without simulating hover — verify against actual rendered
       output before deciding, don't assume either way). Do not weaken or delete the `previous-only` case's
       existing assertion — it must keep passing unchanged.
  </action>
  <verify>
    <automated>node_modules/.bin/vitest run tests/category-subcategory-breakdown.test.tsx</automated>
  </verify>
  <done>current-only rows show a "nuova" badge (not the old inline sentence) with a tooltip reading the full explanatory sentence for the actual year shown; previous-only rows are completely unchanged; all updated/existing assertions in tests/category-subcategory-breakdown.test.tsx pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `?back=` on `/transactions` | Client-reflected query string used to construct a same-tab navigation target (`href` + `router.push`); validated before render, never trusted raw. |
| `?subCategory=`/`?category=`/`?months=` on `/transactions` | Pre-existing transactions filter params (unchanged by this plan) — every underlying query stays scoped to the signed-in `userId` via `verifySession()` + `getTransactions`'s existing ownership joins. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jog-01 | Tampering | `?back=` param (open redirect / arbitrary same-tab navigation) | medium | mitigate | `parseTransactionsBackParam` only accepts values starting with the literal `/dashboard/categories/` prefix; an absolute URL, a protocol-relative `//host` string, `javascript:`, or any foreign in-app path is dropped — no back affordance renders, `router.push`/the `<a href>` never receives an unvalidated value. |
| T-jog-02 | Information Disclosure | `subCategory`/`category` deep-link params reaching `getTransactions` | low | accept | Both params already exist on `/transactions` today via the toolbar (pre-existing trust posture, unchanged by this plan); every query stays scoped to `transaction`/`expense` rows owned by the signed-in `userId`, so a forged id narrows to zero rows, never another user's data — verified by reading `lib/dal/transactions.ts`'s existing scoping, no new code path introduced. |
| T-jog-03 | Repudiation | N/A | low | accept | Read-only navigation feature — no writes occur anywhere in this plan. |

Task 4 introduces no new trust boundary — it renders a static, locally-computed label/tooltip from data
already present in the row (`presence`, `year`), no user input, no new query params.
</threat_model>

<verification>
- `node_modules/.bin/vitest run tests/table-search-params.test.ts tests/transactions-back-link.test.tsx tests/category-subcategory-breakdown.test.tsx tests/category-detail-components.test.tsx tests/detail-page-shell.test.tsx tests/category-ranking-list.test.tsx` — full targeted regression across every file this plan touches, extends, or could break (the last two are read-only regression: neither file is edited by this plan).
- `node_modules/.bin/tsc --noEmit` — run once after all 4 tasks complete.
- `yarn check:language` — confirm "Torna indietro"/"nuova"/the tooltip sentence (and the unchanged existing Italian copy) stay confined to intentional product-copy surfaces; every new identifier/comment stays English.
- Manual smoke (executor, `yarn dev`): (1) open `/dashboard/categories/[id]` for a category with subcategory data, click a subcategory row, confirm you land on `/transactions` with the row's subcategory/category selected and the year's 12 months filtered, and a "Torna indietro" link is visible; click it and confirm you return to the category detail page with its year/view state intact; (2) click one of the top-5 transaction cards, confirm you land on that transaction's detail page; click "Indietro" there and confirm you return to the same category detail page; (3) visit `/transactions` directly with no `back` param and confirm no back affordance renders and nothing else changed; (4) visit `/transactions?back=https://evil.com` directly and confirm no back affordance renders (dropped, not trusted); (5) on a current-only row, confirm a "nuova" badge (not the old sentence) renders and hovering/focusing it shows the full tooltip sentence with the correct year; confirm a previous-only row's "— solo nel {year-1}" suffix is unaffected.
</verification>

<success_criteria>
- NAV-01 through NAV-05 are all observable in the shipped UI exactly as specified — no reduced scope, no deferred pieces.
- A normal `/transactions` visit (no `back` param) and a normal category-detail-page visit (no click-through) are byte-identical to before this plan, aside from the NAV-05 badge/tooltip replacing the old inline sentence on current-only rows.
- `?back=` can never resolve to a non-`/dashboard/categories/` target.
- All new/extended automated tests pass; `tsc --noEmit` and `yarn check:language` are clean.
</success_criteria>

<!-- source-audit
SOURCE  | ID     | Item                                                                       | Plan | Status  | Notes
------- | ------ | ---------------------------------------------------------------------------| ---- | ------- | -----
GOAL    | NAV-01 | Subcategory rows clickable -> transactions table filtered by that filter  | 01   | COVERED | Task 2
GOAL    | NAV-02 | Top-5 transaction rows clickable -> single transaction detail view        | 01   | COVERED | Task 3
GOAL    | NAV-03 | "Torna indietro" on the transactions table when arriving via this filter  | 01   | COVERED | Task 1
GOAL    | NAV-04 | "Torna indietro" in the specific transaction's detail view                | 01   | COVERED | Task 3 (verifies pre-existing DetailPageShell mechanism, no new code needed)
GOAL    | NAV-05 | "nuova nel {year}" inline sentence -> compact badge + tooltip              | 01   | COVERED | Task 4 (added mid-session, user follow-up request)
-->

<output>
Create `.planning/quick/260804-jog-rendere-cliccabili-sottocategorie-catego/260804-jog-SUMMARY.md` when done
</output>
