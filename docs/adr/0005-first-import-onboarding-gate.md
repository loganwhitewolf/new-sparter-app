# First-import onboarding gate

A new user who has never imported any transactions sees a dedicated onboarding flow instead of an empty dashboard.

## Decisions

### Gate condition: zero transactions, not first login

The onboarding gate activates when `count(transaction) === 0` for the authenticated user. It does not track "first login" separately. This means:

- A user who deletes all their data re-enters onboarding automatically.
- A user who abandons mid-onboarding and returns is shown the correct step, not a blank dashboard.

Alternatives considered:
- **`firstLoginAt` flag on `user`**: couples onboarding state to login history, not data state. If the user deletes their data, the flag is stale. Rejected.
- **`onboardingCompletedAt` flag**: requires explicit management (set it, clear it on delete, guard against inconsistency). More schema for no extra value. Rejected.

### Hard gate: no access to the rest of the app before the first import

While zero transactions, the router redirects all authenticated routes to `/onboarding`. The only accessible routes are `/onboarding` and `/settings` (for logout and account management).

The empty dashboard alternative ("soft gate") was rejected because the app has no value without data — an empty dashboard invites the user to explore routes that are meaningless without imports, increasing confusion rather than reducing it. The PO requirement was explicit: "the import must be the first and only thing the user can do on first access."

No "skip and explore" option is provided. There is no demo or sample-data mode.

### Five-step onboarding flow

```
Step 1  Upload
        Single-file drop-zone. Platform auto-detected from header signature.
        If not detected: the import-format-wizard creates a private platform
        (existing service: lib/services/import-format-wizard.ts).
        Multi-file upload is out of scope for onboarding — added to /import
        as a separate improvement.

Step 2  Overview
        Aggregate summary of the uploaded file:
        · N transactions imported
        · Total income (positive_total)
        · Total expenses (negative_total)
        · Months covered (derived label, e.g. "Apr–Mag 2026")
        · % already auto-categorized by Tier 1 regex seed patterns
        No per-month breakdown here — that lives in the dashboard.

Step 3  Categorization education
        Short explanation: "Some transactions were categorized automatically.
        The ones below need your attention."
        Inline tip: transfers and round-trip transactions (giroconto) are assigned
        a FlowNature that excludes them from expense totals in the dashboard — so
        if your numbers look lower than expected, that is why.
        No dedicated FlowNature glossary screen. Education is in-flow only.

Step 4  Manual categorization wizard
        Shows the top 15 uncategorized expenses ordered by |totalAmount| desc.
        (Expenses are already deduplicated by descriptionHash, so one row can
        represent many transactions — no second ordering criterion needed.)
        Each row: description, amount, subcategory autocomplete (search across
        all categories and subcategories), FlowNature badge shown next to each
        subcategory in the dropdown.
        Global skip CTA always visible: "Categorize the rest later" — remaining
        uncategorized expenses are accessible from /import after onboarding.
        Pattern suggestion (regex creation) is intentionally absent from this step.
        The PatternSuggestion feature requires further development before it is
        suitable for onboarding (see ADR 0002 and handoff
        .planning/handoffs/2026-05-28-pattern-regex-evolution.md).

Step 5  Outro
        Two CTAs:
        · "Go to dashboard" → /dashboard (existing route, no firstRun flag)
        · "Customize categories" → /settings/categories (existing route)
        No firstRun query param or special first-run rendering mode. Once the
        user exits onboarding, the app behaves identically for all users.
```

### FlowNature: in-flow education only

FlowNature is introduced via:
1. A contextual tip in Step 3 (transfers/giroconto excluded from dashboard totals).
2. A FlowNature badge next to each subcategory in the Step 4 autocomplete (e.g. `Stipendio · operational`, `Caffè & Bar · discretionary`).

A dedicated FlowNature explanation screen in onboarding was rejected. Users learn concepts by doing, not by reading definitions before they have data. Contextual tooltips in the dashboard ("Why is this transfer not in my expenses?") cover the remaining education need and are deferred to a future improvement.

## Consequences

- The router must check `count(transaction) === 0` on every authenticated navigation and redirect to `/onboarding` if true. This is a new guard — not currently in `proxy.ts`.
- `/onboarding` is a new route with its own step state (client-side or URL-driven, to be decided in planning).
- The onboarding categorization step (Step 4) queries: `SELECT ... FROM expense WHERE userId = ? AND subCategoryId IS NULL ORDER BY ABS(totalAmount) DESC LIMIT 15`.
- `import-format-wizard.ts` is reused as-is — no changes needed for the onboarding upload path.
- Multi-file upload in `/import` (outside onboarding) is a separate task, unblocked by this decision.
