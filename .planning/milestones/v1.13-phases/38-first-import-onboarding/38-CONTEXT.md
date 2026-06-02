# Phase 38: first-import-onboarding — Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (docs/adr/0005-first-import-onboarding-gate.md, docs/adr/0006-file-period-model.md) + Prototype verdict (NOTES.md, variant-b.tsx)

<domain>
## Phase Boundary

New users who have never imported any transactions (count(transaction) === 0) see a dedicated 5-step onboarding flow instead of an empty dashboard. The routing gate is hard (no bypass, no skip, no demo mode). Once the user has at least one transaction the gate lifts permanently and the app behaves identically for all users.

Out of scope:
- Multi-file upload during onboarding (added to /import separately)
- Pattern suggestion / regex creation in Step 4
- "Skip and explore" or demo/sample-data mode
- Dedicated FlowNature glossary screen
- firstRun query param or special first-run rendering in the dashboard
</domain>

<decisions>
## Implementation Decisions

### D-01: Gate condition — zero transactions, not first login

The onboarding gate activates when `count(transaction) === 0` for the authenticated user.
- A user who deletes all their data re-enters onboarding automatically.
- No `firstLoginAt` flag, no `onboardingCompletedAt` flag on the user model.
- **Status: LOCKED**

### D-02: Hard routing gate — no access to app before first import

`proxy.ts` redirects all authenticated routes to `/onboarding` while zero transactions.
Exceptions allowed through: `/onboarding` itself, `/settings` (for logout/account management).
No soft gate, no empty dashboard fallback, no skip option.
- **Status: LOCKED**

### D-03: Five-step flow with URL-driven step state

Steps: Upload (1) → Overview (2) → Education (3) → Categorization wizard (4) → Outro (5).
Step state is URL-driven (`?step=1..5`), not purely client-side, so browser back/forward works and the user who returns mid-flow lands on the right step.
- **Status: LOCKED**

### D-04: Step 1 — Upload

Single-file drop-zone. Platform auto-detected from header signature via `lib/services/import-format-detector.ts`.
If not detected: `import-format-wizard.ts` (existing service, no changes needed) creates a private platform.
- **Status: LOCKED**

### D-05: Step 2 — Overview (aggregate summary only)

Fields: N transactions, total income (positive_total), total expenses (negative_total), months covered (derived label per ADR 0006), % auto-categorized by Tier 1 regex.
No per-month breakdown in onboarding (that lives in the dashboard).
- **Status: LOCKED**

### D-06: Step 3 — Categorization education (in-flow tip)

Short explanation: "Some transactions were categorized automatically. The ones below need your attention."
Inline tip: transfers and giroconto assigned a FlowNature that excludes them from dashboard totals — if numbers look lower than expected, that is why.
No dedicated FlowNature glossary screen. Education is in-flow only.
- **Status: LOCKED**

### D-07: Step 4 — Manual categorization wizard

Query: top 15 uncategorized expenses ordered by `|totalAmount| DESC` (expenses deduplicated by descriptionHash — one row per unique description, no second ordering criterion).
UI: shadcn `Command` + `Popover` combobox (not native `<select>`) with FlowNature badge next to each subcategory in the dropdown.
Global skip CTA: "Categorize the rest later" — always visible, remaining uncategorized expenses accessible from /import after onboarding.
Pattern suggestion (regex creation) intentionally absent from this step.
- **Status: LOCKED**

### D-08: Step 5 — Outro

Two CTAs: "Vai alla dashboard" → `/dashboard`, "Personalizza le categorie" → `/settings/categories`.
No firstRun query param. Once user exits onboarding, app behaves identically.
- **Status: LOCKED**

### D-09: Full-screen hero visual design (Variant B)

Dark background (slate-800/slate-900 gradient) for Steps 1–3 and 5.
Light background (white/gray-50 gradient) for Step 4 (categorization = work context).
Progress dots + step name label in header (right side). Sticky CTA bar at bottom for Steps 2–4.
Tokens must use design system CSS variables (not hardcoded Tailwind classes as in prototype).
- **Status: LOCKED**

### D-10: Month label — derived projection, not stored field (ADR 0006)

`referenceStartedAt` / `referenceEndedAt` already exist on `file` table. No migration needed.
Months-covered label computed as: `DATE_TRUNC('month', MIN(transaction.date))` → `DATE_TRUNC('month', MAX(transaction.date))`.
Displayed as "Apr 2026" (single month) or "Apr–Mag 2026" (range). Display-only, never stored.
- **Status: LOCKED**

### D-11: Proxy guard implementation

`proxy.ts` runs in Next.js middleware (edge-compatible). The transaction count check must be fast:
- Option A: dedicated `/api/onboarding-check` route — adds network hop in middleware.
- Option B: DAL query inside middleware — not possible (edge runtime, no Drizzle direct).
- **Decision: Use Better Auth session + a lightweight server-side redirect within the (app) layout** rather than in `proxy.ts` edge middleware. The proxy stays thin (session-only). The layout server component calls `getTransactionCount(userId)` and returns a redirect to `/onboarding` when count is 0. This is consistent with the existing pattern of keeping heavy queries in RSC layouts, not middleware.
- `/settings` and `/onboarding` are excluded from the redirect.
- **Status: LOCKED**

### D-12: Prototype cleanup

`app/(app)/prototype/onboarding/` and `components/ui/prototype-switcher.tsx` are deleted in the same commit that ships the real implementation (not a separate phase).
- **Status: LOCKED**

### Claude's Discretion

- Exact shadcn component composition within the step screens (beyond the Combobox mandate for Step 4)
- Animation strategy between steps (CSS transition vs framer-motion vs none)
- Whether to co-locate step components in `app/(app)/onboarding/` or extract to `components/onboarding/`
- Exact Zod validation shape for the categorization action called from Step 4 (reuse `categorizeExpense` or a new bulk action)
- Test strategy for the routing guard
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design decisions (fully locked)
- `docs/adr/0005-first-import-onboarding-gate.md` — 5-step flow, gate condition, FlowNature education
- `docs/adr/0006-file-period-model.md` — months-covered derived label, no stored month field

### Prototype reference (UI direction)
- `app/(app)/prototype/onboarding/_variants/variant-b.tsx` — winning variant, component structure, step layout
- `app/(app)/prototype/onboarding/NOTES.md` — prototype verdict and implementation todos

### Existing services to reuse (no changes)
- `lib/services/import-format-detector.ts` — platform auto-detection from file header
- `lib/services/import-format-wizard.ts` — private platform creation for unknown formats
- `lib/services/import.ts` — `importFile()` — runs inside `db.transaction`; accepts `DbOrTx`

### Existing DAL to reuse or extend
- `lib/dal/transactions.ts` — `getUncategorizedTransactionsByFileId` (extend for onboarding query)
- `lib/dal/categories.ts` — `getCategories()` used for subcategory combobox
- `lib/dal/imports.ts` — import list queries

### Existing actions to reuse
- `lib/actions/expenses.ts` — `categorizeExpense`, `bulkCategorize` — check if sufficient or needs new bulk action for Step 4
- `lib/actions/import.ts` — `analyzeImportAction`, `confirmImportAction` — reuse for onboarding upload flow

### Routing and auth
- `proxy.ts` — session-only middleware; onboarding gate goes in RSC layout, not here
- `lib/routes.ts` — add `onboarding: '/onboarding'` route constant
- `lib/auth-session.ts` — session retrieval pattern

### Design system
- `components/ui/` — shadcn components: `Command`, `Popover`, `Button`, `Progress`
- `app/(app)/` layout — RSC layout pattern (session check + conditional redirect)
</canonical_refs>

<specifics>
## Specific Implementation Notes

### Routing guard (D-11)

The `(app)/layout.tsx` (or a new `onboarding` route group layout) is the correct place for the transaction count check:

```tsx
// app/(app)/layout.tsx
const { userId } = await verifySession()
const count = await getTransactionCount(userId)
if (count === 0 && !pathname.startsWith('/onboarding') && !pathname.startsWith('/settings')) {
  redirect('/onboarding')
}
```

`getTransactionCount` is a new DAL function: `SELECT COUNT(*) FROM transaction WHERE userId = ?`.

### Step 4 categorization query

```sql
SELECT DISTINCT ON (expense.description_hash)
  expense.id, expense.description, expense.total_amount
FROM expense
WHERE expense.user_id = :userId
  AND expense.sub_category_id IS NULL
  AND expense.total_amount < 0  -- expenses only (outflows)
ORDER BY expense.description_hash, ABS(expense.total_amount) DESC
LIMIT 15
```

(The ADR specifies "top 15 uncategorized expenses by |totalAmount| DESC, deduplicated by descriptionHash".)

### Months-covered label DAL query (D-10)

```sql
SELECT DATE_TRUNC('month', MIN(t.occurred_at)) AS first_month,
       DATE_TRUNC('month', MAX(t.occurred_at)) AS last_month
FROM transaction t
WHERE t.file_id = :fileId
```

Format as "Mmm YYYY" or "Mmm–Mmm YYYY" for single/multi-month.

### URL-driven step state

`/onboarding?step=1` (default), `?step=2`, ..., `?step=5`. The server component reads `searchParams.step`, validates 1–5, defaults to 1. State advances on server action completion or client-side navigation with `router.push`.

### FlowNature badge in combobox

Each subcategory option in the `Command` list shows: `[subcategory name] · [nature label]`. Nature label from `lib/utils/nature-labels.ts` (already exists from Phase 37). Badge styling: small pill with nature color or text, visible inline.
</specifics>

<deferred>
## Deferred Ideas

- Multi-file upload during onboarding (separate improvement to /import)
- Pattern suggestion / regex creation in onboarding Step 4 (deferred per handoff 2026-05-28-pattern-regex-evolution.md)
- Dedicated FlowNature glossary screen (deferred to dashboard contextual tooltips)
- Demo/sample-data mode or "skip and explore" option
- Dashboard contextual tooltips ("Why is this transfer not in my expenses?")
- Month-picker on /import file list (date-range filter is the decision; month-picker deferred)
</deferred>

---

*Phase: 38-first-import-onboarding*
*Context gathered: 2026-05-28 via ADR Ingest Express Path*
