# Feature Landscape — Sparter

**Domain:** Personal finance web app, Italian market
**Researched:** 2026-04-22
**Sources:** BUSINESS_LOGIC_HANDOFF.md + seed.ts (primary); domain knowledge on Italian banking/fintech ecosystem
**Note on web research:** WebSearch and WebFetch were unavailable in this session. All findings below are sourced from the project documents or from HIGH-confidence domain knowledge about the Italian banking/fintech space. Where domain knowledge is the sole source, confidence is stated explicitly.

---

## 1. Table Stakes — What Exists in Scope (Confirmation)

These are features users expect from any personal finance app. They are already defined in the current scope. This section confirms coverage and flags any gaps within each item.

### 1.1 CSV/Excel Import from Italian Banks
**Coverage:** Confirmed in scope.
Initial bank/payment platforms are seeded with versioned import formats: General (generic), Satispay, Intesa Sanpaolo, Revolut, Fineco, and other existing adapters from the handoff. Platform identity must stay separate from file format versions so a bank can evolve its export layout without becoming a new platform.

**Coverage assessment — HIGH confidence:**
- Intesa Sanpaolo is the largest Italian bank by retail account volume. Having both conto corrente and carta di credito as separate format versions under the platform is correct: they export different column layouts and the `multiplyBy: -1` on the credit card format is essential (credit card CSVs from Intesa SP list charges as positive values, unlike current account statements).
- Fineco is a top-3 digital bank in Italy with high adoption among tech-savvy users. The `separate` amount type (Entrate/Uscite columns) is well-known among Italian developers who work with Fineco exports.
- Satispay is a dominant P2P/payment wallet in Italy, especially for under-40 users. Correct inclusion.
- Revolut is used heavily by Italian digital nomads and remote workers.

**Confirmed gaps in bank coverage (see Section 2 for full gap analysis):**
- UniCredit, BancoBPM, Poste Italiane not yet supported.
- N26 (widely used in Italy) not yet supported.
- Hype/Buddybank not yet supported.

### 1.2 Automatic Expense Categorization
**Coverage:** Confirmed in scope — Tier 1 (regex, 28 patterns) + Tier 2 (history-based, weight threshold 3).
**Confidence:** HIGH — The two-tier system with regex → history fallback is a well-established pattern in personal finance apps that lack ML budget for v1. The AI tier is correctly deferred.

**Regex pattern quality assessment:**
- Supermarket patterns cover the top Italian chains (Esselunga, Conad, Coop, Carrefour, Lidl, Eurospin, MD, Aldi, Despar). Solid.
- Telecom patterns include all major MVNO operators (Iliad, ho., Kena, Very Mobile, Spusu). Very thorough.
- Streaming patterns cover the full Italian streaming market (DAZN, RaiPlay, Mediaset Infinity are Italian-specific additions — good).
- PagoPA at confidence 0.75 with "da classificare manualmente" comment is correct: PagoPA is used for taxes, school fees, parking fines, municipal services — too ambiguous for reliable auto-categorization.
- Missing: Deliveroo / JustEat / Glovo (food delivery) — these generate high transaction volume and appear frequently in Italian bank statements. They would map to `take-away`. **Gap.**
- Missing: Booking.com / Airbnb / eDreams (travel booking) — frequent for Italian users, would map to `vacanze > alloggio` or `vacanze > trasporto`. **Gap.**

### 1.3 Dashboard KPI
**Coverage:** Confirmed in scope.
- `getOverview`: totalIn, totalOut, balance, savingsRate, uncategorizedCount + delta vs previous month.
- `getCategoriesBreakdown`: per-category totals with percentage.
- `getAggregatedTransactionsData`: monthly trend with in/out/nc/ignored breakdown.
- Date presets: last-month, last-3-months, last-6-months, this-year, last-year.

**Assessment:** The KPI set covers the minimum viable dashboard. See Section 2 for recommended additions.

### 1.4 Manual Expense Management
**Coverage:** Confirmed in scope — CRUD on expenses with category assignment.
**Note:** The Expense model (semantic aggregation of transactions with same `descriptionHash`) is a design decision that differs from most apps, which show raw transactions. This aggregation makes category assignment efficient (categorize once, applies to all matching transactions). It is the right design for import-heavy use cases but needs clear UX communication so users understand why "NETFLIX" appears as one item even if charged 6 times.

### 1.5 Deduplication
**Coverage:** Confirmed. `transactionHash` (MD5 of amount+description+timestamp) prevents double-import. Solid.

### 1.6 Italian Localization
**Coverage:** Confirmed — app in Italian, categories/subcategories in Italian, error messages bilingual.
**Assessment:** Correct. Italian users strongly prefer UIs in Italian, especially in finance. The category taxonomy is well-adapted (e.g., "spesa" vs "shopping" distinction is meaningful in Italian, "bollette e utilità" maps to how Italians mentally frame utility bills).

### 1.7 Subscription Tiers
**Coverage:** Confirmed. free/basic/pro, with auto-categorization gated behind basic+.
**Note:** The feature gate design (free = manual only) is standard for personal finance SaaS. The risk is that free users have poor retention because manual categorization is tedious. See Anti-Features section.

### 1.8 User Authentication
**Coverage:** Confirmed — NextAuth v5, email/password, JWT session.
**Assessment:** Adequate for v1. No OAuth is a deliberate scope reduction. Acceptable.

---

## 2. Gaps — Features Potentially Missing from v1 Scope

These are items that Italian users plausibly expect or that the import/categorization workflow needs to feel complete. They are NOT all required for v1 but warrant a conscious include/exclude decision.

### Gap 2.1 — Missing Bank Platforms (HIGH confidence)
**Severity:** MEDIUM — affects the fraction of users whose primary bank is not in the list.

| Bank/Platform | Italian Market Position | CSV Export Support | Notes |
|--------------|------------------------|-------------------|-------|
| UniCredit | 2nd largest Italian bank | Yes — exports CSV via "Estratto Conto" with `Valuta`, `Importo`, `Causale`, `Descrizione` columns | High-priority addition |
| BancoBPM | 3rd largest Italian bank | Yes — CSV export available | Medium priority |
| Poste Italiane (BancoPosta) | Very large retail base, especially over-50 | Yes — CSV/Excel | Medium priority; column format is distinct |
| N26 | Popular with digital-native Italians | CSV and XLSX export | High priority (same demographic as Sparter users) |
| Hype | Sella Group neobank, popular in Italy | CSV export | Lower priority |
| ING Italia | Decent market share in Italy | CSV export | Lower priority |
| Wise | Used for international transfers, common in remote workers | CSV export, distinct format | Lower priority |

**Recommendation:** UniCredit and N26 are the highest-value additions for the Sparter target demographic (tech-savvy Italian under-45). The `General` platform provides an escape hatch for unsupported banks, but column mapping must be user-friendly.

**Confidence:** HIGH for UniCredit/N26 being widely used; MEDIUM for exact column formats (not verifiable without live exports).

### Gap 2.2 — Import UX: Preview Step Before Commit (HIGH confidence)
**Severity:** HIGH — this is the difference between a polished import and an anxiety-inducing one.

The target v1 import flow is:
1. Upload → R2
2. Analyze structural signals (columns, headers, date format, delimiter, currency, amount shape)
3. User confirms detected platform + format version or chooses manually
4. Preview shows row count, duplicate count, confidence and sample parsed rows
5. `importFile()` — creates transactions, expenses, runs categorization

**What's needed:** A preview/dry-run step before the final import commit that shows the user:
- How many rows will be imported
- How many rows will be skipped (duplicates)
- Which platform and format version were detected, with confidence
- A sample of the first N parsed rows with their detected date, description, and amount
- A warning if the date format was guessed (e.g., "We detected dates in DD/MM/YYYY format — does this look right?")

Without this preview, the user presses "import" and either nothing visible happens (bad) or a flood of transactions appears (alarming). The preview turns import from a black box into a transparent, confirmable action.

**Confidence:** HIGH — this pattern is standard in any data import tool (Firefly III, YNAB CSV import, MoneyMoney on macOS all implement preview steps).

### Gap 2.3 — Import UX: Row-Level Error Reporting (MEDIUM confidence)
**Severity:** MEDIUM.

When a row fails to parse (malformed date, non-numeric amount, empty description), the current flow likely silently skips it. Users expect to know:
- "X rows were imported successfully, Y rows had errors"
- Optionally: show the problematic rows with the specific error

This is especially important for the `General` import format where column mapping is user-defined and prone to misconfiguration.

**Confidence:** MEDIUM — behavior of current implementation on parse errors not documented in HANDOFF.

### Gap 2.4 — Bulk Categorization Action (HIGH confidence)
**Severity:** HIGH — this directly determines whether the first session after import feels productive or frustrating.

The current data model allows categorizing one Expense at a time. After importing 6 months of statements, a new user may face 30-80 uncategorized expenses (those that didn't match regex or history). 

**What's missing:** A "Categorize All" or batch-select UI on the uncategorized list:
- Select multiple expenses
- Assign same category to all selected
- Keyboard shortcut support (space = select, enter = confirm, arrow = navigate)

Apps that do this well (Wallet by BudgetBakers, Banktivity) convert the "uncategorized inbox" into a fast triage workflow rather than a slog.

**Confidence:** HIGH — this is a well-known UX pattern for the categorization inbox.

### Gap 2.5 — Uncategorized Count as Persistent Nudge (MEDIUM confidence)
**Severity:** MEDIUM — affects retention, not core function.

`getOverview` already returns `uncategorizedCount`. The gap is whether this count is surfaced as a persistent badge/CTA in the UI rather than buried in the dashboard stats. Users should see "12 expenses to categorize" as a primary action item every time they open the app, not as a secondary metric.

**Confidence:** MEDIUM — depends on UI implementation decisions, not documented.

### Gap 2.6 — Italian Fiscal Year / Date Convention Nuances (MEDIUM confidence)
**Severity:** LOW-MEDIUM.

Italy uses the calendar year as the fiscal year (1 January – 31 December), so the `this-year` / `last-year` presets are correctly aligned. No adjustment needed.

However, two Italian-specific date conventions are worth noting:
- Italian bank statements use DD/MM/YYYY exclusively. The platform adapters handle this correctly per the seed data. But the `General` platform has `dateFormat: null` — if the user uploads a file with Italian date format, the general parser must not default to US MM/DD/YYYY. **Risk:** silent date misparse that puts transactions in wrong months.
- Italian banks sometimes include both `Data` (transaction date) and `Data Valuta` (value date, typically 1-3 days later). Fineco's `Descrizione_Completa` column may encode the value date. For KPI accuracy, the transaction date (not value date) should be used. The current schema stores a single `timestamp` — this is correct but worth guarding at parse time.

**Confidence:** HIGH for the DD/MM/YYYY convention; MEDIUM for Data Valuta behavior (not verifiable without live Fineco exports).

### Gap 2.7 — Transfers Between Own Accounts (HIGH confidence)
**Severity:** MEDIUM — affects KPI accuracy significantly.

The `ignore` category exists for this purpose, with subcategories `trasferimento` and `addebito carta di credito`. This is correct design. However, for users who import both their current account AND their credit card from Intesa SP, the credit card charge will appear in the current account statement as an outflow. If the user also imports the credit card statement, all individual purchases appear there. Without the `ignore` category applied to the current account debit, every credit card purchase gets counted twice.

**What's needed:**
- Regex pattern for "addebito carta di credito" → `ignore > addebito-carta-di-credito` (partially present in seed)
- UX education: a tooltip or onboarding note explaining when to use `ignore`
- Possibly: auto-detect when a user imports both an account and its matching credit card, and warn about potential double-counting

**Confidence:** HIGH — this is a well-known pain point in multi-account import workflows.

### Gap 2.8 — "General" Platform Column Mapping UI (MEDIUM confidence)
**Severity:** HIGH for users of unsupported banks.

The `General` import format uses standard `description`, `amount`, `timestamp` column names. If a user uploads a UniCredit CSV (which has `Causale`, `Importo EUR`, `Data`) and selects "General", the import will produce empty descriptions and zero amounts because the column names don't match.

**What's needed:** When "General" is selected (or when import format detection returns low confidence), show a column-mapping UI where the user can drag/select which CSV column maps to description, amount, date.

This is a high-effort feature but may be critical for v1 usability given that only 5 specific Italian banks are supported.

**Confidence:** HIGH — the need is structural given the current platform model.

### Gap 2.9 — Missing Food Delivery Regex Patterns (HIGH confidence)
**Severity:** LOW-MEDIUM.

Deliveroo, JustEat, Glovo, and Wolt are among the most frequent transaction descriptions in Italian bank statements for the 25-40 demographic. These map clearly to `take-away`. Their absence from the 28 seeded patterns means they will land in `da categorizzare` for every new user.

**Confidence:** HIGH — these platforms are dominant in Italian urban markets.

### Gap 2.10 — Date Range Filter on Expense/Transaction List (MEDIUM confidence)
**Severity:** MEDIUM.

The dashboard KPIs support date presets. It is unclear whether the expense list (the CRUD view) also supports date filtering. Users who imported 2 years of statements will want to filter the list to "Q3 2025" or "last 3 months" rather than scrolling through everything.

**Confidence:** MEDIUM — not documented in HANDOFF whether list views expose date filtering.

### Gap 2.11 — Export / Report Generation (LOW confidence for v1 scope)
**Severity:** LOW for v1.

Italian users occasionally need to export their categorized data for tax purposes (e.g., deductible medical expenses, proof of freelance income). A CSV export of filtered transactions is a frequently requested feature that personal finance apps add early. It is deliberately not in v1 scope, but it should be on the backlog.

**Confidence:** MEDIUM — domain expectation; not verifiable without user research.

---

## 3. Anti-Features — Deliberately Avoid

These are features commonly added to personal finance apps that consistently generate negative feedback, churn, or development debt disproportionate to their value.

### Anti-Feature 3.1 — Notifications / Push Reminders for Spending
**What goes wrong:** Apps add "You've spent 80% of your restaurant budget!" notifications. Italian users perceive these as nagging and disable them immediately, or worse, uninstall.
**Why it happens:** Product teams conflate engagement metrics with user value. Notifications drive opens but not satisfaction.
**What to do instead:** Surfacing insights passively in the dashboard (e.g., "restaurant spending is 40% higher than last month") respects user autonomy. Let users pull insights, don't push them.
**Confidence:** HIGH — this is a well-documented pattern in personal finance app reviews (Mint/Intuit's demise was partly driven by notification overload).

### Anti-Feature 3.2 — Budgets / Budget Alerts as a v1 Feature
**What goes wrong:** Budget features require users to set targets before they have enough data to know what's realistic. New users set budgets, immediately exceed them, feel shame, and stop using the app. This is the "empty budget" problem.
**Why it happens:** Budgets feel like the natural follow-up to categorization. They are, but only after 3-6 months of data.
**What to do instead:** Build the data layer first (which Sparter v1 does correctly). Offer budgets as a v2+ feature once users have historical baselines.
**Confidence:** HIGH — this is explicitly deferred, and that decision is correct.
**Note:** The current scope correctly excludes budgets. Do not add them under pressure.

### Anti-Feature 3.3 — Recurring Transaction Detection with Auto-Actions
**What goes wrong:** Apps try to detect recurring payments (subscriptions, rent) and offer to "mark them recurring" or "predict future charges." The detection has many false positives (e.g., similar-amount grocery trips), and the auto-action logic becomes a maintenance burden when users change banks or have irregular income.
**Why it happens:** Recurring detection seems like a natural extension of the expense aggregation model.
**What to do instead:** The Expense aggregation model (N transactions → 1 Expense) already implicitly handles this: "NETFLIX" as a single Expense with 12 transactions is the natural recurring view. No extra complexity needed.
**Confidence:** HIGH.

### Anti-Feature 3.4 — Bank Sync via Open Banking / PSD2
**What goes wrong:** Italian banks have notoriously incomplete PSD2 API implementations. Real-time sync via Nordigen/GoCardless/Plaid is appealing but introduces: OAuth flows per bank, token refresh complexity, rate limits, bank-specific quirks, GDPR data processing obligations, and dependency on third-party aggregators that can change pricing or availability. The operational overhead is disproportionate to v1.
**Why it happens:** "Why does the user have to export CSV manually? Just connect the bank!" is a reasonable question.
**What to do instead:** CSV import with good UX (preview, dedup, fast categorization) is a sufficient v1. The manual friction is acceptable when the payoff (clean categorized data) is immediate. Defer PSD2 to v2+.
**Confidence:** HIGH — Italian PSD2 fragmentation is well-documented in the Italian fintech community.

### Anti-Feature 3.5 — Gamification (Streaks, Badges, Points)
**What goes wrong:** Finance apps add streaks ("You've logged expenses 7 days in a row!") to drive daily engagement. This is misaligned with how personal finance actually works — users import a batch once a month, not daily. Gamification creates guilt when the streak breaks, not motivation.
**Why it happens:** Consumer app playbooks from habit-formation apps (Duolingo, fitness apps) are applied wholesale to finance.
**What to do instead:** Nothing. The value proposition is clarity, not engagement.
**Confidence:** HIGH.

### Anti-Feature 3.6 — Overly Granular Category Taxonomy (User-Editable)
**What goes wrong:** Apps that let users add unlimited custom categories/subcategories quickly devolve into unmaintainable hierarchies. Users create "Coffee > Morning Coffee > Espresso at Usual Bar" and then stop categorizing because it's too much work.
**Why it happens:** "Flexibility" sounds good. It isn't.
**What to do instead:** The current design — fixed seeded taxonomy, not user-editable — is the correct call. The 26 categories and ~120 subcategories already cover the Italian spending landscape comprehensively. Resist pressure to make categories user-customizable.
**Confidence:** HIGH.

### Anti-Feature 3.7 — Social / Sharing Features
**What goes wrong:** "Share your savings chart with friends" features. Finance is private in Italy (more so than Northern Europe). These features go unused and add compliance surface area.
**Confidence:** HIGH.

### Anti-Feature 3.8 — In-App Advertising / "Sponsored" Financial Products
**What goes wrong:** Recommending credit cards, loans, or insurance products based on spending patterns. Even non-intrusive versions erode trust in a tool that users expect to be purely on their side.
**Confidence:** HIGH.

---

## 4. Feature Dependencies Map

```
Auth
  └─► Expense CRUD (manual)
        └─► Dashboard KPI (data source)
              └─► Import (enriches dashboard)
                    └─► Import Advanced (regex custom + history)
                          └─► AI Categorization (v2)

Import
  └─► Platform + format-version matching
        └─► Column mapping UI (Gap 2.8 — needed for General platform usability)

Expense Aggregation
  └─► Categorization pipeline
        └─► Bulk categorization UX (Gap 2.4)
              └─► Uncategorized badge/CTA (Gap 2.5)
```

---

## 5. MVP Scope Verdict

### Confirmed Correct — Do Not Change
1. Expense aggregation model (N transactions → 1 Expense by descriptionHash)
2. Two-tier categorization (regex → history) before AI
3. Fixed Italian category taxonomy — do not make it user-editable in v1
4. No budgets, no bank sync, no notifications
5. `ignore` category for internal transfers
6. Italian-first localization
7. PagoPA at confidence 0.75 with manual review flag

### Should Add to v1 (High Impact, Low Effort)
1. **Food delivery regex patterns** (Deliveroo, JustEat, Glovo, Wolt) — 30 min of dev, high categorization hit rate for target demographic
2. **Import preview step** — show row count, duplicate count, detected platform/version, confidence and sample rows before committing import
3. **Row-level import error reporting** — "3 rows skipped due to parse errors" with row details
4. **Persistent uncategorized badge** in nav/header — always visible, drives categorization completion

### Should Add to v1 (High Impact, Medium Effort)
5. **Bulk categorization action** on uncategorized expense list — select N expenses, assign category, confirm
6. **Date range filter on expense list** — not just on dashboard

### Should Add to v2 (Important but Deferrable)
7. **UniCredit and N26 platform adapters** — critical for market coverage
8. **Column mapping UI for General platform** — needed when user's bank is unsupported
9. **Double-counting warning** for users importing both current account and credit card
10. **CSV export of categorized transactions** — tax/audit use case

### Confirmed Out of Scope (Do Not Build in v1)
- Budgets and budget alerts
- Bank sync / PSD2
- Recurring transaction detection with auto-actions
- Gamification
- Social/sharing features
- Investment tracking
- Push notifications
- Custom user categories

---

## 6. Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Italian bank platform coverage | HIGH | Seed data review + Italian banking market knowledge |
| Italian date/fiscal year conventions | HIGH | Well-established conventions |
| Import UX patterns (preview, error reporting) | HIGH | Standard in data import tooling |
| Categorization UX patterns (bulk, badge) | HIGH | Standard in personal finance apps |
| Regex pattern gaps (food delivery) | HIGH | Italian fintech market knowledge |
| Missing bank platforms (UniCredit, N26) | HIGH (existence) / MEDIUM (exact column formats) | Cannot verify formats without live exports |
| Dashboard KPI conventions | HIGH | Documented in HANDOFF, standard patterns confirmed |
| Anti-features rationale | HIGH | Well-documented failure patterns in personal finance apps |
| PSD2 fragmentation in Italy | HIGH | Known Italian fintech ecosystem issue |
