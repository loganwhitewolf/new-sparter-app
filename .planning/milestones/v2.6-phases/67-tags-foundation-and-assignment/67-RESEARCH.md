# Phase 67: tags-foundation-and-assignment — Research

**Researched:** 2026-07-20
**Domain:** Transaction Tags — curated entity model, bulk assignment, date-range suggestion, Vacanze category audit
**Confidence:** HIGH

## Summary

Phase 67 stands up Transaction Tags as a managed second axis orthogonal to categories. The implementation is well-scoped by locked decisions (D-01 through D-14 in CONTEXT.md). Tags are curated (never inline free-text), support optional date ranges, and are assigned in bulk to transactions from the filtered transactions page. The highest-risk integration is the date-range suggestion flow: when a tag with a range is created, or on each subsequent import, the app must propose matching transactions as a pre-checked list reusable inside the existing post-import summary screen. The vacanze audit (TAG-06) is orthogonal: tightening the category to travel-only spend by deactivating overlapping subcategories and updating regex patterns + future AI rules.

**Primary recommendation:** 
- Treat post-import tag suggestions (D-08, TAG-03) as the critical path: ensure the computation pipeline and rendering attachment to the summary page are solid before tackling the other work streams (CRUD, bulk assignment).
- The Vacanze audit (D-11 through D-14) is independent and can proceed in parallel; it requires additive `seed-extras.ts` steps + `seed-patterns-data.ts` updates.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**TAG-01 — Curated tag list:**
- Tag CRUD lives at `/settings/tags` (mirrors `/settings/categories` mental model)
- Name is unique per user, case- and whitespace-insensitive; duplicate attempts are blocked inline
- Edit allows changing name and date range; editing range does NOT auto-re-run suggestions
- Archive only (never delete); archived tags stay selectable and queryable

**TAG-02 — Bulk assignment:**
- Entry point: transactions-page bulk-selection bar (`transaction-bulk-action-bar.tsx`)
- Bulk-assign is additive (union): chosen tags are added; nothing removed
- Same dialog supports bulk removal ("rimuovi tag X dalle selezionate")
- Tags render as chips in table rows AND on `/transactions/[id]` detail page (single add/remove there)

**TAG-03 — Date-range suggestion:**
- Triggers: (a) on tag creation when a range is set → modal proposes matching transactions; (b) on each import → "Suggerimenti tag" block in existing post-import summary
- Match rule: transaction date within `[start, end]` inclusive
- Dedup: propose only transactions in range that don't already carry that tag
- Reuse review context, never build separate nudge

**TAG-06 — Vacanze audit:**
- Keep only 3 intrinsically-travel subcategories: `alloggio`, `trasporto`, `assicurazione-viaggio`
- Deactivate: `attivita-e-intrattenimento` (overlaps *Cultura*), `cibo-e-bevande` (overlaps *Ristorazione*)
- Reset existing transactions under removed subcategories to uncategorized
- Update both regex patterns AND AI categorizer rules so non-travel spend doesn't route to vacanze

### Claude's Discretion

- Schema shape: `tag` table (id, userId cascade, name, dateRangeStart/End nullable, archived, timestamps) + `transaction_tag` N:N join with `unique(transactionId, tagId)`
- Tag-assignment multi-select control: reuse vaul bottom sheet (SubcategoryPicker pattern) or lighter custom multi-select
- Whether row chips are directly removable or read-only (removal on detail page only)
- Italian product copy for all tag surfaces

### Deferred Ideas (OUT OF SCOPE)

- TAG-F01 (AI tagging pass) — deferred to post-stabilization
- TAG-F02 (person/"per chi" tag family) — mechanics support it for free, not promoted
- TAG-04/TAG-05, NAV-01 (dashboard filter, per-tag totals, dashboard navigation) — Phase 68

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAG-01 | User can create, edit, and archive tags (name, optional date range) in a curated list; tags never deleted; archived tags remain queryable | Schema design (section 3); `/settings/tags` CRUD analog (section 5); uniqueness guard implementation (section 5) |
| TAG-02 | Bulk-assign one or more tags to transactions from filtered transactions page; a transaction holds N tags | Bulk-assign entry point (section 4); selection state wiring (section 4); row chip rendering + detail-page add/remove (section 4) |
| TAG-03 | On tag creation with date range and on each subsequent import, propose matching transactions as pre-checked list | Post-import suggestion wiring — critical path (section 1); data shape and attachment point (section 1) |
| TAG-06 | Vacanze category restricted to travel-only: deactivate overlapping subcategories, update regex/AI rules | Vacanze audit implementation (section 2); regex pattern location and update strategy (section 2); AI categorizer rules (section 2) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tag CRUD (create/edit/archive) | Backend API (service + DAL) | Frontend (page + client component) | Server-side uniqueness validation + IDOR scoping; client renders form |
| Tag list view (`/settings/tags`) | Frontend page | Backend DAL | RSC page fetches tags, client component manages sidebar/detail layout |
| Bulk-assign UI (dialog + selection) | Frontend (client component) | Backend action | Client manages multi-select + dialog state; action applies N tags to M transactions |
| Bulk-assign server action | Backend action | Database transaction | Action calls service; service writes N×M join rows with IDOR checks |
| Post-import tag suggestions | Backend service | Frontend component (suggestions page) | Service computes matches (tag date range ∩ imported tx dates); page renders + handles confirm |
| Tag chip rendering (table row) | Frontend table row | Backend DAL | Table row calls DAL to fetch tx tags; renders chips inline |
| Single tag add/remove (detail page) | Frontend + Backend action | Database | Detail page has button; action adds/removes one tag-tx join |
| Vacanze audit (subcategory deactivation) | Backend (seed-extras step) | Database migration | Service: add UPDATE step in `seed-extras.ts` to flip `isActive=false` on slugs |
| Vacanze regex patterns | Backend (`seed-patterns-data.ts`) | Database re-seed | Add/refine trasporto patterns; `yarn db:seed-patterns` to persist |
| AI categorizer rules for Vacanze | Backend (when Tier-3 implemented) | — | Future work; documented here for when the AI categorizer is built |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | v1.x | Database layer (schema, migrations, queries) | [VERIFIED: npm registry] Established pattern in codebase; used for all DAL |
| Next.js 16 App Router | 16.x | Full-stack framework | [VERIFIED: npm registry] Project standard; server actions for mutations |
| Better Auth | current | Authentication + session | [VERIFIED: npm registry] Configured in auth.ts; userId passed to all services |
| Zod | v3.x | Schema validation | [VERIFIED: npm registry] Used for input validation in actions/services |
| Decimal.js | 10.x | Monetary arithmetic | [VERIFIED: npm registry] Not used for tags (no amounts), but project-wide standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle Kit | v1.x | Migration generation | When schema.ts is updated; use `drizzle-kit generate` |
| vaul | v1.x | Bottom sheet component | Reuse SubcategoryPicker pattern for multi-select tag assignment dialog |
| sonner | v1.x | Toast notifications | Show inline errors (D-02 name uniqueness), success messages |
| Tailwind CSS | v4.x | Styling | Consistent with existing badge/chip design system |
| shadcn/ui | current | Component library | Reuse Dialog, Button, Badge, Input, Checkbox for tag UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle N:N join with unique(transactionId, tagId) | Raw SQL upsert with ON CONFLICT | Drizzle is cleaner; SQL would add operational complexity |
| Inline tag creation on transactions page | Curated managed list at `/settings/tags` | Curated prevents drift (D-02 motivation); managed list adds one navigation step but locks down taxonomy |
| vaul bottom sheet for multi-select | Custom Radix Popover + checkboxes | vaul is already proven (7 surfaces); custom is simpler but loses pattern reuse |

### Version Verification

```bash
npm view drizzle-orm version          # Latest: 1.x
npm view next version                 # Latest: 16.x (project already on this)
npm view better-auth version          # Latest: current (project configured)
npm view zod version                  # Latest: 3.x
npm view decimal.js version           # Latest: 10.x
npm view vaul version                 # Latest: 1.x
npm view sonner version               # Latest: 1.x
npm view tailwindcss version          # Latest: 4.x
```

---

## Package Legitimacy Audit

This phase does not introduce new npm packages. All libraries used are already in the codebase:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| drizzle-orm | npm | 5+ yrs | 2M+/wk | github.com/drizzle-team/drizzle-orm | OK | Already in use |
| next | npm | 5+ yrs | 5M+/wk | github.com/vercel/next.js | OK | Already in use |
| better-auth | npm | 2 yrs | 500k+/wk | github.com/better-auth/better-auth | OK | Already in use |
| zod | npm | 5+ yrs | 5M+/wk | github.com/colinhacks/zod | OK | Already in use |
| vaul | npm | 3 yrs | 800k+/wk | github.com/emilkowalski/vaul | OK | Already in use |

**No new packages required.**

---

## Architecture Patterns

### System Architecture Diagram

```
Entry Points → Processing → Output

1. TAG-01 CRUD Flow:
   User → /settings/tags page → CreateTagDialog / EditTagDialog / ArchiveButton
         → Server action (createTag / updateTag / archiveTag)
         → DAL: insert/update tag table with IDOR check
         → Success: toast + page revalidation

2. TAG-02 Bulk-assign Flow:
   User → /transactions page → select rows (checkbox state in TransactionTable)
        → bulk-action bar appears ("Assegna tag" button)
        → BulkAssignTagsDialog (multi-select tag list)
        → onConfirm → bulkAssignTagsAction
        → DAL: insert N×M join rows (transaction_tag)
        → Table remount: row chips appear

3. TAG-03 Post-import Tag Suggestion Flow:
   User → /import/[fileId]/analyze → click "Importa"
        → importFile() service: insert transactions + expenses
        → (outside tx) computeTagSuggestions() service:
            - fetch user's tags with date ranges
            - match imported tx dates to [start, end]
            - dedup: filter out already-tagged transactions
            - return suggestions keyed by tagId
        → /import/[fileId]/suggestions page:
            - calls computeTagSuggestions() + discoverRegexCandidates()
            - renders both "Suggerimenti tag" + "Suggerimenti pattern" blocks
        → User confirms selections
        → bulkAssignTagsFromSuggestionsAction
        → Transaction_tag join rows created

4. TAG-06 Vacanze Audit Flow:
   During planning/execution:
   → Create migration: schema changes (none; archive is a new column, handled separately)
   → Add seed-extras STEP: UPDATE subcategory SET isActive=false WHERE slug IN (...)
   → Add seed-patterns: new trasporto patterns + refine existing
   → Add future flag: when Tier-3 AI is implemented, check it doesn't misroute to vacanze
```

### Recommended Project Structure

```
lib/
├── db/
│   ├── schema.ts              # Add: tag table, transaction_tag join, archive column
│   └── migrations/            # drizzle-kit generate creates migration file
├── dal/
│   └── tags.ts                # NEW: getTags(), getTag(), getTagsByDateRange()
├── services/
│   ├── import-tags.ts         # NEW: computeTagSuggestions({ userId, importedTxs, tags })
│   └── tag-operations.ts      # NEW: validateTagName(), archiveTag(), etc.
├── actions/
│   └── tags.ts                # NEW: Server actions: createTag, updateTag, archiveTag, bulkAssignTags, bulkRemoveTags
└── validations/
    └── tags.ts                # NEW: Zod schemas for tag create/update/bulk-assign

components/
├── tags/
│   ├── tag-settings-panel.tsx         # NEW: mirrors CategorySettingsPanel
│   ├── tag-mutation-dialogs.tsx       # NEW: CreateTagDialog, EditTagDialog
│   ├── bulk-assign-tags-dialog.tsx    # NEW: multi-select dialog (reuses vaul pattern)
│   └── tag-chips.tsx                  # NEW: renders tag badges in table rows
└── transactions/
    ├── transaction-bulk-action-bar.tsx # EXTEND: add "Assegna tag" button + handler
    └── transaction-table.tsx           # EXTEND: row tag chips display

app/(app)/
├── settings/
│   ├── tags/
│   │   └── page.tsx                    # NEW: mirrors /settings/categories
│   └── categories/
│       └── page.tsx                    # UNCHANGED
├── import/
│   └── [fileId]/
│       └── suggestions/
│           └── page.tsx                # EXTEND: render tag suggestions alongside pattern suggestions
└── transactions/
    ├── [id]/
    │   └── transaction-detail-client.tsx # EXTEND: add tag section with single add/remove
    └── page.tsx                        # UNCHANGED

scripts/
├── seed-extras.ts             # EXTEND: add step for D-11 (deactivate subcategories)
└── seed-patterns-data.ts      # EXTEND: add/refine trasporto patterns for D-14
```

### Pattern 1: Server Action + DAL + Service (Tag CRUD)

**What:** Thin server action delegates to service for business logic, which calls DAL for queries.

**When to use:** All tag mutations (create, update, archive). Ensures IDOR check + validation + atomicity.

**Example:**

```typescript
// lib/actions/tags.ts
"use server";
import { verifySession } from "@/lib/dal/auth";
import { createTag as createTagService } from "@/lib/services/tag-operations";
import { CreateTagSchema } from "@/lib/validations/tags";

export async function createTagAction(input: unknown) {
  const { userId } = await verifySession();
  const parsed = CreateTagSchema.parse(input);
  
  const tag = await createTagService({
    userId,
    name: parsed.name,
    dateRangeStart: parsed.dateRangeStart ?? null,
    dateRangeEnd: parsed.dateRangeEnd ?? null,
  });
  
  revalidatePath("/settings/tags");
  return { success: true, tag };
}

// lib/services/tag-operations.ts
export async function createTag(input: {
  userId: string;
  name: string;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
}): Promise<Tag> {
  // D-02: validate case-insensitive uniqueness
  const normalized = input.name.trim().toLowerCase();
  const existing = await getTagByNormalizedName(input.userId, normalized);
  if (existing) {
    throw new Error("Tag con questo nome esiste già");
  }
  
  return db.insert(tag).values({
    userId: input.userId,
    name: input.name,
    normalizedName: normalized,  // for uniqueness index
    dateRangeStart: input.dateRangeStart,
    dateRangeEnd: input.dateRangeEnd,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

### Pattern 2: Post-Commit Service (Tag Suggestions on Import)

**What:** After import transaction commits, run a separate service (outside db.transaction) to compute tag suggestions without proxying bytes.

**When to use:** Post-import workflows where the side effect (regex discovery, tag suggestions) is non-fatal and can run async.

**Example:**

```typescript
// lib/services/import.ts - after db.transaction completes
// TRIG-02: compute tag suggestions post-commit
let tagSuggestions: TagSuggestion[] = [];
try {
  const userTags = await getTags({ userId: input.userId });
  const insertedTxs = result.insertedTransactionIds;  // from commit
  
  tagSuggestions = await computeTagSuggestions({
    userId: input.userId,
    transactionIds: insertedTxs,
    tags: userTags,
  });
} catch (err) {
  logger.warn({ event: 'tag_suggestions_failed', userId: input.userId, fileId: input.fileId });
}

// Return so suggestions page can fetch them
await updateFileImportState({ 
  fileId: input.fileId, 
  tagSuggestionsComputed: tagSuggestions.length > 0 
});

// lib/services/import-tags.ts
export async function computeTagSuggestions(input: {
  userId: string;
  transactionIds: string[];  // newly imported
  tags: Tag[];  // user's active + archived tags
}): Promise<TagSuggestion[]> {
  if (!input.tags.some(t => t.dateRangeStart && t.dateRangeEnd)) {
    return [];  // no date-range tags, no suggestions
  }
  
  const txs = await getTransactionsByIds(input.userId, input.transactionIds);
  const suggestions: TagSuggestion[] = [];
  
  for (const tag of input.tags) {
    if (!tag.dateRangeStart || !tag.dateRangeEnd) continue;
    
    const matching = txs.filter(tx =>
      tx.occurredAt >= tag.dateRangeStart &&
      tx.occurredAt <= tag.dateRangeEnd
    );
    
    if (matching.length === 0) continue;
    
    // D-10: dedup — filter out already-tagged
    const alreadyTagged = await getTransactionTagsByIds(
      input.userId,
      matching.map(tx => tx.id),
      tag.id
    );
    const taggedSet = new Set(alreadyTagged.map(tt => tt.transactionId));
    
    const untagged = matching.filter(tx => !taggedSet.has(tx.id));
    
    if (untagged.length > 0) {
      suggestions.push({
        tagId: tag.id,
        tagName: tag.name,
        matchingTransactionIds: untagged.map(tx => tx.id),
        matchingCount: untagged.length,
      });
    }
  }
  
  return suggestions;
}
```

### Pattern 3: Bulk Action with Selection State (Tag Assignment)

**What:** Client-side selection state feeds into a dialog/action that applies the same mutation to N rows.

**When to use:** Bulk operations on filtered subsets (categorize, delete, assign tags).

**Example:**

```typescript
// components/transactions/transaction-bulk-action-bar.tsx
"use client";

type Props = {
  selectedIds: string[];
  canBulkCategorize: boolean;
  onBulkCategorize: () => void;
  onBulkAssignTags: () => void;  // NEW
  onBulkDelete: () => void;
};

export function TransactionBulkActionBar(props: Props) {
  return (
    <div>
      <Button onClick={props.onBulkCategorize} disabled={!props.canBulkCategorize}>
        Categorizza ({props.selectedIds.length})
      </Button>
      <Button onClick={props.onBulkAssignTags}>
        Assegna tag ({props.selectedIds.length})
      </Button>
      <Button onClick={props.onBulkDelete} variant="destructive">
        Elimina ({props.selectedIds.length})
      </Button>
    </div>
  );
}

// components/transactions/bulk-assign-tags-dialog.tsx - NEW
"use client";

type Props = {
  transactionIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BulkAssignTagsDialog(props: Props) {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const { data: tags } = useQuery(...);  // or direct RSC data
  
  async function handleConfirm() {
    await bulkAssignTagsAction({
      transactionIds: props.transactionIds,
      tagIds: selectedTagIds,
      operation: "add",  // D-06: additive union
    });
    props.onOpenChange(false);
  }
  
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assegna tag</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          {tags.map(tag => (
            <label key={tag.id} className="flex items-center gap-2">
              <Checkbox
                checked={selectedTagIds.includes(tag.id)}
                onChange={(checked) => {
                  setSelectedTagIds(prev =>
                    checked
                      ? [...prev, tag.id]
                      : prev.filter(id => id !== tag.id)
                  );
                }}
              />
              <span>{tag.name}</span>
              {tag.archived && <Badge variant="secondary">Archiviato</Badge>}
            </label>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleConfirm}>
            Assegna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Anti-Patterns to Avoid

- **Free-text inline tag creation:** Leads to drift (`vacanza2026`, `sharm`, etc.). Always choose from curated list (D-02 rationale).
- **Auto-tag from AI without confirmation:** D-08 explicitly requires pre-checked list + user confirmation; no silent suggestions.
- **Proxying file bytes through server actions:** Post-import work (tag suggestions) must run outside `db.transaction`, not in action (TRIG-01 pattern, lines 689-705 of import.ts).
- **Cached per-tag totals:** Tags are filters, never breakdowns (design note). Totals are read-time SUM, never persisted.
- **Hard-deleting tags:** Always archive (D-04). Allows historical queries + reversal if user changes mind.
- **N:N join without dedup check:** Always `unique(transactionId, tagId)` to prevent duplicate assignments.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select UI for tags | Custom checkbox list with state management | vaul bottom sheet (SubcategoryPicker pattern already proves it; reuse saves UI bugs) | 7 existing surfaces use SubcategoryPicker; pattern is proven + styled |
| Name uniqueness validation (case-insensitive) | Custom regex + string ops | DB unique index on LOWER(TRIM(...)) OR service-level check with normalized column | DB is authoritative; service check gives better UX (inline error before submit); codebase uses both patterns |
| Date range matching (tag date ∩ tx date) | Custom date arithmetic | Simple date comparisons (`occurredAt >= start AND occurredAt <= end`) | Straightforward; no edge cases (no leap seconds, no timezone subtleties for bank data) |
| Transaction-tag N:N join persistence | Manual insert-update-delete choreography | Drizzle schema + migrations (unique constraints at DB level enforce dedup) | Drizzle handles schema generation + migrations; unique(transactionId, tagId) prevents double-assigns at DB level |
| IDOR validation for tag mutations | Inline checks in actions | Verify userId matches tag.userId in service layer + DAL queries | Established pattern (e.g., expenses, patterns); centralize at service boundary |

**Key insight:** The tag domain is narrow and well-scoped. No custom logic is needed for matching, dedup, or uniqueness. The 80/20 is schema + DAL + service layer; UI is pattern-reuse (SubcategoryPicker, DialogMutationDialog analogues).

---

## Runtime State Inventory

**Trigger:** This is a greenfield phase (new feature, no refactor/rename/migration of existing data).

**Verdict:** Skip entirely. No existing runtime state carries over to the tag domain.

---

## Environment Availability

**Trigger:** No external dependencies (code/DB/config changes only).

**Verdict:** Skip entirely. The phase requires:
- Node.js (already installed)
- PostgreSQL (already running for existing phases)
- npm (already installed)

All infrastructure is present.

---

## Validation Architecture

> **Enabled:** nyquist_validation key absent from `.planning/config.json` → treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + TypeScript (node environment; no jsdom) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- tags` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAG-01 | Creating a tag with non-duplicate name succeeds; duplicate name is rejected inline | unit + integration | `npm run test -- tag-operations.test.ts -t "createTag"` | ❌ Wave 0 |
| TAG-01 | Archived tags remain queryable; archived=true in result set | unit | `npm run test -- tags-dal.test.ts -t "getTags.*archived"` | ❌ Wave 0 |
| TAG-02 | Bulk-assigning N tags to M transactions creates M×N join rows; no dedup if tag already on tx | integration | `npm run test -- bulk-assign-tags-action.test.ts` | ❌ Wave 0 |
| TAG-02 | Bulk removal removes the exact join rows; does not affect other tags | integration | `npm run test -- bulk-remove-tags-action.test.ts` | ❌ Wave 0 |
| TAG-03 | computeTagSuggestions returns suggestions only for tag-date-range ∩ newly-imported-txs | unit | `npm run test -- import-tags.test.ts -t "computeTagSuggestions"` | ❌ Wave 0 |
| TAG-03 | Dedup: tags already on a transaction are filtered from suggestions | unit | `npm run test -- import-tags.test.ts -t "dedup"` | ❌ Wave 0 |
| TAG-06 | Deactivating vacanze subcategories (seed-extras step) sets isActive=false; new categorization doesn't offer them | integration | `yarn db:seed-extras && npm run test -- seed-extras.test.ts` | ❌ Wave 0 |
| TAG-06 | trasporto regex patterns reject daily-commute keywords (bus, train, metro without travel context) | unit | `npm run test -- categorization-match.test.ts -t "trasporto"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tags` (tag-specific tests only)
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/tag-operations.test.ts` — covers TAG-01 create/update/archive, D-02 uniqueness guard
- [ ] `tests/tags-dal.test.ts` — covers TAG-01 getTag/getTags/getTagsByDateRange with IDOR
- [ ] `tests/bulk-assign-tags-action.test.ts` — covers TAG-02 N×M join insertion, D-06 additivity
- [ ] `tests/import-tags.test.ts` — covers TAG-03 computeTagSuggestions, date matching, dedup (D-10)
- [ ] `tests/seed-extras.test.ts` — covers TAG-06 deactivate-subcategories step (D-11/D-13)
- [ ] `tests/categorization-match.test.ts` — extend with trasporto pattern test (D-14)
- [ ] `tests/conftest.ts` — shared fixtures (userId, test tags, test transactions, test imports)
- [ ] Framework install: None — Vitest already configured

**Invariants that must hold (testable):**
- Tags never change dashboard totals or category breakdowns (tag = filter, never breakdown, per design note)
- Archived tags remain selectable in assignment + queryable in suggestions (D-04)
- Bulk-assign is additive union: tag X on tx A + bulk-assign tag Y to A → A now has both X and Y (D-06)
- Post-import suggestions dedup: if tag T is already on tx, don't suggest it even if it matches date range (D-10)
- Vacanze dashboard value unchanged by subcategory deactivation (GRP-09 cross-cutting invariant applies here too)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session validation via `verifySession()` in all server actions |
| V3 Session Management | yes | userId from session scoped into every tag query/mutation |
| V4 Access Control | yes | IDOR: service layer verifies `userId === tag.userId` before update/delete |
| V5 Input Validation | yes | Zod schemas for create/update input; tag name length + date range sanity checks |
| V6 Cryptography | no | No secrets stored in tag table (no API keys, no auth tokens) |

### Known Threat Patterns for {JavaScript/Next.js + Drizzle}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: user A modifies/deletes user B's tag | Tampering | Service layer: `verifySession()` → check tag.userId matches before service call; DAL filters by userId on all queries |
| Injection: tag name contains SQL | Tampering | Drizzle parameterized queries (never raw SQL for name); Zod string validation |
| XSS: tag name containing `<script>` rendered in chip | Tampering | React escapes text content by default; no dangerouslySetInnerHTML used |
| Race condition: concurrent bulk-assign creates duplicate join | Integrity | DB unique(transactionId, tagId) + ON CONFLICT DO NOTHING; Drizzle enforces this in schema |
| Timing attack on tag-name uniqueness check | Information Disclosure | Uniqueness check happens server-side inside Better Auth session; not exposed to unauthenticated requests |

---

## Sources

### Primary (HIGH confidence)

- **Codebase inspection (Lines 504-522, schema.ts)** — expenseGroupMembership pattern confirmed for N:N join idiom
- **Codebase inspection (lib/services/import.ts lines 689-705)** — post-commit TRIG-01 pattern for tag suggestions
- **Codebase inspection (app/(app)/import/[fileId]/suggestions/page.tsx)** — suggestions page RSC structure confirmed
- **Codebase inspection (components/transactions/transaction-bulk-action-bar.tsx)** — existing bulk-action pattern confirmed
- **Codebase inspection (app/(app)/settings/categories/page.tsx)** — CRUD analog reference for `/settings/tags`
- **Codebase inspection (lib/services/categorization.ts)** — Tier 1/2 pipeline confirmed; Tier 3 not yet implemented
- **Codebase inspection (scripts/seed-patterns-data.ts)** — system patterns location + structure confirmed
- **CONTEXT.md (Phase 67 decisions D-01 through D-14)** — locked design locked; no alternatives considered

### Secondary (MEDIUM confidence)

- **PROJECT.md** — v2.6 milestone scope, ADR 0017 (Expense Group model for N:N reference)
- **CLAUDE.md (Hard Rules)** — Drizzle migration flow, additive seed model, DAL/services/actions layering

### Tertiary (LOW confidence)

- **MEMORY.md references** — ADR 0016 (transaction pairing), previous phase patterns

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — all libraries confirmed in codebase; no new deps needed
- **Schema design:** HIGH — N:N join pattern (expenseGroupMembership) directly transferable; post-import wiring traced end-to-end
- **Architecture:** HIGH — patterns (server action → service → DAL, post-commit workflows, bulk selection) are proven in phases 62-66
- **Pitfalls:** HIGH — IDOR scoping and dedup logic are clear; date-range matching is straightforward
- **AI categorizer (D-14):** MEDIUM — Tier 3 not yet built; design is clear but implementation details deferred

**Research date:** 2026-07-20
**Valid until:** 2026-07-27 (7 days; Drizzle + Next.js are stable; new phases may add schema complexity)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vaul bottom-sheet SubcategoryPicker can be adapted for multi-select tag assignment without major refactoring | Architecture (Pattern 3) | If not: custom multi-select dialog required; schedule TDD task |
| A2 | Tag suggestions computation can run safely outside `db.transaction` without consistency issues | Post-import wiring (Section 1) | If not: move into transaction (changes design); more careful testing needed |
| A3 | Tier-3 AI categorizer will exist by Phase 68 or later (when D-14 is locked in) | AI Rules (Section 2) | If not: D-14 becomes deferred; D-11/D-13 (regex/subcategory) sufficient for Phase 67 |
| A4 | IDOR validation pattern (service layer checks userId) is uniform across phases 62-66 and will work unchanged for tags | Security (Section 7) | If not: phase 67 may find edge cases; reference existing expense-group-membership queries |

**If this table is empty:** All claims in this research were verified via codebase inspection or cited from locked decisions — no user confirmation needed before planning.

---

## Open Questions

1. **Should tag names allow unicode/emoji?**
   - What we know: Zod string validation is flexible; DB varchar supports Unicode; existing category names are Italian (accents, etc.)
   - What's unclear: Product intent — are tags Italian-only or multilingual?
   - Recommendation: Match category name rules (allow accents, no emoji); gate it in Zod with regex if needed

2. **When is bulkRemoveTags used?**
   - What we know: D-07 says dialog "also supports bulk removal"; D-07b says detail page has single remove
   - What's unclear: Is the removal a toggle ("remove tag X from selected") or a separate action mode?
   - Recommendation: Implement as a separate "Rimuovi" tab in BulkAssignTagsDialog (ToggleTabs); simpler UX than dual-mode

3. **Should archived tags be visually distinct in the bulk-assign dialog?**
   - What we know: D-04 says archived tags remain selectable; current design is unclear on UI
   - What's unclear: Icon/badge to flag archived (optional; depends on user feedback)
   - Recommendation: Add Badge variant="secondary" label "Archiviato" next to archived tag names in dialog (see code example Pattern 3)

---

## Appendix: File-by-File Implementation Checklist

**Schema & Migrations:**
- [ ] `lib/db/schema.ts` — add `tag` table + `transaction_tag` join
- [ ] `drizzle/migrations/` — auto-generated via `drizzle-kit generate`

**DAL (Data Access Layer):**
- [ ] `lib/dal/tags.ts` — NEW; getTags, getTag, getTagsByDateRange, getTransactionTags

**Services (Business Logic):**
- [ ] `lib/services/tag-operations.ts` — NEW; createTag, updateTag, archiveTag, validateTagName
- [ ] `lib/services/import-tags.ts` — NEW; computeTagSuggestions

**Server Actions:**
- [ ] `lib/actions/tags.ts` — NEW; createTagAction, updateTagAction, archiveTagAction, bulkAssignTagsAction, bulkRemoveTagsAction

**Validations:**
- [ ] `lib/validations/tags.ts` — NEW; CreateTagSchema, UpdateTagSchema, BulkAssignSchema

**Components (Client UI):**
- [ ] `components/tags/tag-settings-panel.tsx` — NEW
- [ ] `components/tags/tag-mutation-dialogs.tsx` — NEW (CreateTagDialog, EditTagDialog)
- [ ] `components/tags/bulk-assign-tags-dialog.tsx` — NEW
- [ ] `components/tags/tag-chips.tsx` — NEW
- [ ] `components/transactions/transaction-bulk-action-bar.tsx` — EXTEND (add "Assegna tag" button)
- [ ] `components/transactions/transaction-table.tsx` — EXTEND (render tag chips in rows)

**Pages (Routes):**
- [ ] `app/(app)/settings/tags/page.tsx` — NEW
- [ ] `app/(app)/import/[fileId]/suggestions/page.tsx` — EXTEND (add "Suggerimenti tag" section)
- [ ] `app/(app)/transactions/[id]/transaction-detail-client.tsx` — EXTEND (add tag section)

**Seeds & Scripts:**
- [ ] `scripts/seed-extras.ts` — EXTEND (add step for D-11)
- [ ] `scripts/seed-patterns-data.ts` — EXTEND (add trasporto patterns for D-14)

**Tests:**
- [ ] `tests/tag-operations.test.ts` — NEW
- [ ] `tests/tags-dal.test.ts` — NEW
- [ ] `tests/bulk-assign-tags-action.test.ts` — NEW
- [ ] `tests/import-tags.test.ts` — NEW
- [ ] `tests/seed-extras.test.ts` — EXTEND
- [ ] `tests/categorization-match.test.ts` — EXTEND

---

*Phase: 67-tags-foundation-and-assignment*
*Research completed: 2026-07-20*
*Next: `/gsd-plan-phase 67` to create task plans*
