# Phase 67: tags-foundation-and-assignment - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning
**Phase requirements:** TAG-01, TAG-02, TAG-03, TAG-06
**Depends on:** Nothing (independent — no dependency on Expense Group phases 65–66)

<domain>
## Phase Boundary

Stand up **Transaction Tags** as a curated second axis, orthogonal to categories
(*category = what, tag = why/where/for whom*). This phase delivers the foundation +
assignment half of the feature:

- **TAG-01** — a curated tag list (create/edit/archive, **never delete**); name + optional
  date range; archived tags stay selectable/queryable.
- **TAG-02** — bulk-assign one or more tags to transactions from the (filtered)
  transactions page; a transaction holds N tags.
- **TAG-03** — date-range suggestion: on tag creation (with a range) and on each subsequent
  import, propose the transactions falling in the range as a pre-checked confirmable list.
- **TAG-06** — audit the **vacanze** (Viaggi) category so it holds only intrinsically-travel
  spend; move the overlapping subcategories out and update regex + AI categorizer rules.

**Not this phase (Phase 68):** dashboard global tag-filter (TAG-04), the Tag section with
per-tag totals (TAG-05), dashboard→transactions navigation (NAV-01). **Deferred forever /
later:** AI tagging pass (TAG-F01), person/"per chi" tag family as a promoted concept
(TAG-F02 — mechanics support it for free).

**Cross-cutting rule (from design note):** "tag = filter, never breakdown." Tags never
change dashboard totals or category breakdowns — they are a filter axis. (The one per-tag
total view is TAG-05, Phase 68.)

</domain>

<decisions>
## Implementation Decisions

### TAG-01 — Curated tag list surface & rules
- **D-01:** The tag CRUD (create / edit / archive) lives at **`/settings/tags`**, mirroring
  the existing `/settings/categories` mental model (tag = configuration entity, not a place
  you "work"). No new primary sidebar entry in this phase — the analytics-facing "Tag
  section" with per-tag totals is Phase 68.
- **D-02:** Tag **name is unique per user, case- and whitespace-insensitive**; a duplicate
  create/rename attempt is **blocked with an inline error**. This is the structural
  anti-degeneration guard the design note demands (no `vacanza2026` / `vacanza-2026` /
  `sharm` drift). Tags are never free-typed inline — always chosen from the managed list.
- **D-03:** Edit allows changing **both name and date range** after creation. Changing the
  range does **not** auto-re-run the suggestion (the suggestion is an explicit act, see
  D-08), but the new range governs future import-time suggestions.
- **D-04:** Archive, never delete (locked by design note): an `archived` flag on the tag;
  archived tags remain selectable in assignment and queryable in filters. No hard-delete
  path exists.

### TAG-02 — Bulk assignment from the transactions page
- **D-05:** Entry point is the **transactions-page bulk-selection bar**
  (`transaction-bulk-action-bar.tsx`), adding an **"Assegna tag"** action alongside the
  existing "Categorizza"/"Elimina". Filter → select → assign is the natural post-import flow.
- **D-06:** Bulk-assign is **additive (union)**: the chosen tags are added to whatever the
  selected transactions already carry; nothing is removed. Coherent with N-tags-per-tx and
  multi-pass tagging.
- **D-07:** The same assignment dialog **also supports bulk removal** ("rimuovi tag X dalle
  selezionate") — symmetric, useful after a wrong suggestion. Single-transaction add/remove
  also exists (D-07b).
- **D-07b:** A transaction's current tags render as **chips in the transactions table row**
  *and* in a tag section on the **`/transactions/[id]` detail page**, where single-tag
  add/remove happens. (Row chips carry the display; puntual add/remove lives on the detail
  page — planner decides whether row chips are also directly removable.)

### TAG-03 — Date-range suggestion flow
- **D-08:** Two triggers: **(a) on tag creation** when a date range is set — a modal proposes
  matching transactions immediately; **(b) on each subsequent import** — a **"Suggerimenti
  tag" block inside the existing post-import summary screen** (where pattern-suggestions
  already live), one pre-checked checklist per tag whose range intercepts newly-imported
  transactions. Reuse a review context the user already sees; do not build a separate nudge.
- **D-09:** **Match rule = transaction date within `[start, end]` inclusive**, nothing else.
  Foreign-currency / merchant heuristics belong to the deferred AI pass (TAG-F01). The user
  refines by deselecting from the pre-checked list.
- **D-10:** **Dedup:** on each import, propose only transactions in range that **do not
  already carry that tag**. The suggestion is "capture the new ones", never a re-confirmation
  of already-tagged transactions.

### TAG-06 — Vacanze (Viaggi) category audit
- **D-11:** The category is **`vacanze` (id 4)**. Keep only the **3 intrinsically-travel
  subcategories: `alloggio`, `trasporto`, `assicurazione viaggio`**. **Deactivate** the two
  overlapping ones: **`attivita-e-intrattenimento`** (overlaps *Cultura e tempo libero*) and
  **`cibo-e-bevande`** (overlaps *Ristorazione* — the "restaurant on vacation"). (User
  confirmed the verdict case-by-case.)
- **D-12:** **Existing transactions** categorized under the two removed subcategories are
  reset to **"da categorizzare" (uncategorized)**, so the user re-assigns them to the correct
  category (Ristorazione / Cultura…) + optional tag. No best-effort auto-remap — correctness
  over convenience, since the right fine subcategory can't be safely guessed. Done via an
  explicit, additive migration.
- **D-13:** Deactivation follows the **additive taxonomy model**: append a step to
  `scripts/seed-extras.ts` that flips `isActive=false` on the two subcategory slugs (and the
  uncategorize migration of their transactions) — never edit `seed-data.ts` shapes. A
  disabled subcategory is not offered for future categorization but remains referentially
  intact.
- **D-14:** **Both** regex patterns (`scripts/seed-patterns-data.ts`, re-seeded via
  `yarn db:seed-patterns`) **and** the AI categorizer rules are updated so non-travel spend
  no longer routes into `vacanze`. `trasporto` regex must exclude daily commuting (only
  travel transport — flight/ferry/rental — belongs here). This is success criterion 4.

### Claude's Discretion
- Schema shape: a `tag` table (`id`, `userId` cascade, `name`, `dateRangeStart`/`End`
  nullable, `archived`, timestamps) + a `transaction_tag` N:N join
  (`unique(transactionId, tagId)`), migrated via `drizzle-kit generate` + `scripts/migrate.ts`.
  The columns are constrained by D-01..D-04 but the exact schema is the planner's call.
- Whether the tag-assignment multi-select control reuses the vaul bottom-sheet pattern
  (as `SubcategoryPicker`) or a lighter multi-select — planner/executor choose, provided
  it supports multi-tag select + the archived-still-selectable rule (D-04).
- Whether table-row chips are directly removable or read-only-with-detail-page-removal (D-07b).
- Italian product copy for all tag surfaces (buttons, dialogs, empty states).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked design (the source of truth — do not re-open the model)
- `/Users/andreabernardini/Documents/Note & Progetti personali/Notes/progetti/sparter-tag-transazioni.md`
  — the design note (Obsidian, 2026-07-06). Locks: tag = managed entity (never inline free
  string), optional date range, N tags/tx, `archived` never delete; assignment = bulk-tagging
  + date-range suggestion (AI pass deferred); "tag = filter, never breakdown"; the Viaggi
  audit rationale. **This note is outside the repo** — quote its decisions into planning docs;
  do not rely on downstream agents having filesystem access to it.
- `.planning/REQUIREMENTS.md` §"Transaction Tags (TAG)" — TAG-01/02/03/06 definitions, the
  Out-of-Scope table (no per-tag breakdown charts; no status/reimbursement tags — covered by
  pairing + Standalone Expense per ADR 0016), and Future Requirements (TAG-F01, TAG-F02).

### Domain language & conventions
- `CONTEXT.md` (repo root) — Transaction vs Expense vocabulary; keep tag product copy Italian,
  code/comments/tests English (`yarn check:language`).
- `CLAUDE.md` — additive seed model (`seed-extras.ts` STEPS + `seed-patterns-data.ts` full
  re-seed), DAL/services/actions layering, IDOR scoping, migration flow, feature gates
  (auto-categorization tiers — relevant to the AI-rule update in D-14).

### Related model boundaries (why certain tag families are out of scope)
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` —
  transaction pairing + Standalone Expense already cover "da rimborsare"/"condivisa"; status
  tags are intentionally NOT a tag family (design note ❌).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/transactions/transaction-bulk-action-bar.tsx` — existing bulk bar
  (`selectedIds`, `canBulkCategorize`, `onBulkCategorize`, `onBulkDelete`); add the
  "Assegna tag" action + handler here (D-05).
- `components/transactions/transaction-table.tsx` + `TransactionsToolbar.tsx` +
  `transactions.table.ts` — the transactions table already has selection, filtering, and a
  declarative config; row-chip rendering (D-07b) and selection plumbing hook in here.
- `app/(app)/transactions/[id]/transaction-detail-client.tsx` — transaction detail page;
  gains the tag section with single add/remove (D-07b).
- `SubcategoryPicker` (vaul bottom sheet, 7 existing surfaces) — reference pattern for the
  tag multi-select control (D-05); reuse the bottom-sheet idiom rather than inventing UI.
- `/settings/categories` (settings taxonomy management) — the analog for the `/settings/tags`
  CRUD page (D-01); mirror its layout/patterns.
- Post-import summary flow — `lib/services/import.ts`, `lib/actions/import.ts`,
  `lib/dal/imports.ts`, and the summary screen that already renders `patternSuggestions`
  (v1.10 Phases 33–36 delivered this). The "Suggerimenti tag" block (D-08) attaches to that
  same screen.
- `scripts/seed-extras.ts` (ordered STEPS) + `scripts/seed-patterns-data.ts` /
  `scripts/seed-patterns.ts` — the additive taxonomy + regex machinery for D-11..D-14.

### Established Patterns
- Schema (`lib/db/schema.ts`): `transaction` (L416), `subCategory` (L164), `category` (L142),
  `categorizationPattern` (L524). New `tag` + `transaction_tag` tables land here; follow the
  cascade/`unique(...)` idioms already used by `expenseGroupMembership` (L504,
  `unique(groupId,expenseId)` + `unique(expenseId)`).
- Layering: DAL queries in `lib/dal/`, business logic in `lib/services/`, thin `"use server"`
  in `lib/actions/`; IDOR-scope every tag mutation to `userId` + tag ownership; migrations via
  `drizzle-kit generate` + `scripts/migrate.ts` (never `drizzle-kit push`).
- Vacanze taxonomy (`scripts/seed-data.ts`): category `vacanze` id 4; subcategories
  `alloggio`, `trasporto`, `attivita-e-intrattenimento`, `cibo-e-bevande`,
  `assicurazione-viaggio` (all `natureId: 4`). D-11 deactivates the middle two.
- No Decimal.js concern in this phase: tags carry no monetary amount (per-tag totals are a
  read-time SUM in Phase 68).

### Integration Points
- Import pipeline → post-import summary: TAG-03 import-time suggestion (D-08) must run after
  transactions are persisted and feed the summary screen without proxying file bytes.
- Transactions selection state → bulk bar → assignment action (D-05/D-06/D-07).
- The uncategorize migration (D-12) resets `transaction.subCategoryId`/status for the two
  removed subcategories — verify this doesn't disturb the dashboard-invariant expectations
  from v2.6 (it's a *deliberate* recategorization, allowed; grouping/tagging invariance is a
  separate concern).

</code_context>

<specifics>
## Specific Ideas

- Motivating case (design note): "quanto ho speso per la vacanza a Sharm 2026" — today needs
  category Viaggi + month filtering (noisy); tags make it a clean orthogonal filter.
- Anti-degeneration is a hard requirement: the whole point of a *managed* list is that
  `vacanza2026`/`sharm` variants can't proliferate — D-02's blocking uniqueness is structural,
  not cosmetic.
- The date-range suggestion is explicitly "the point where the feature lives or dies" — nobody
  tags 40 transactions by hand; get the pre-checked checklist + dedup (D-08..D-10) right.
- Viaggi audit has a positive side effect the note calls out: category stats stop being dirty
  (restaurant-in-vacation no longer hidden in Viaggi → Ristorazione totals become truthful).

</specifics>

<deferred>
## Deferred Ideas

- **AI tagging pass (TAG-F01)** — pipeline suggests tags from signals (foreign currency,
  unusual merchants, restaurant density ⇒ probable trip). Post-stabilization; out of first cut.
- **Person / "per chi" tag family (TAG-F02)** — the mechanics support it for free, but it is
  NOT promoted as a product concept this phase.
- **Dashboard global tag-filter (TAG-04), Tag section with per-tag totals (TAG-05),
  dashboard→transactions navigation (NAV-01)** — all Phase 68.
- **Status/reimbursement & behavioral tag families** — permanently out of scope (design note
  ❌; already covered by pairing + Standalone Expense, ADR 0016).

None of the above were folded into this phase; discussion stayed within TAG-01/02/03/06 scope.

</deferred>

---

*Phase: 67-tags-foundation-and-assignment*
*Context gathered: 2026-07-20*
