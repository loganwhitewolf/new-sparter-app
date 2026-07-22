# Phase 67: tags-foundation-and-assignment - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 22 files (11 new, 6 extended, 5 tests)
**Analogs found:** 21 / 22 (95%)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db/schema.ts` (tag + transaction_tag) | model | CRUD | `expenseGroupMembership` | exact |
| `lib/dal/tags.ts` | DAL | CRUD | `lib/dal/categories.ts` | exact |
| `lib/services/tag-operations.ts` | service | CRUD | `lib/dal/categories.ts` (createUserCategory pattern) | role-match |
| `lib/services/import-tags.ts` | service | post-import | `lib/services/import.ts` (TRIG-01) | exact |
| `lib/actions/tags.ts` | action | request-response | `lib/actions/transactions.ts` | exact |
| `lib/validations/tags.ts` | validation | CRUD | `lib/validations/transactions.ts` | role-match |
| `components/tags/tag-settings-panel.tsx` | component | CRUD | `components/categories/category-settings-panel.tsx` | exact |
| `components/tags/tag-mutation-dialogs.tsx` | component | CRUD | `components/categories/category-mutation-dialogs.tsx` | exact |
| `components/tags/bulk-assign-tags-dialog.tsx` | component | CRUD | `components/expenses/bulk-categorize-dialog.tsx` | exact |
| `components/tags/tag-chips.tsx` | component | display | `components/ui/badge.tsx` | partial |
| `app/(app)/settings/tags/page.tsx` | page | CRUD | `app/(app)/settings/categories/page.tsx` | exact |
| `components/transactions/transaction-bulk-action-bar.tsx` | component | CRUD | same file | extend |
| `components/transactions/transaction-table.tsx` | component | display | same file | extend |
| `app/(app)/import/[fileId]/suggestions/page.tsx` | page | request-response | same file | extend |
| `app/(app)/transactions/[id]/page.tsx` client section | component | display | `app/(app)/transactions/[id]/page.tsx` | extend |
| `scripts/seed-extras.ts` | script | batch | same file (STEPS array) | extend |
| `scripts/seed-patterns-data.ts` | script | batch | same file (systemCategorizationPatterns) | extend |
| `tests/tag-operations.test.ts` | test | unit | `tests/categories.test.ts` | role-match |
| `tests/tags-dal.test.ts` | test | unit | `tests/categories.test.ts` | role-match |
| `tests/bulk-assign-tags-action.test.ts` | test | integration | `tests/expenses.test.ts` | role-match |
| `tests/import-tags.test.ts` | test | unit | `tests/import.test.ts` | role-match |

---

## Pattern Assignments

### `lib/db/schema.ts` — `tag` + `transaction_tag` tables

**Analog:** `lib/db/schema.ts` lines 504-522 (expenseGroupMembership)

**Schema pattern — N:N join with composite unique + standalone unique:**

```typescript
// expenseGroupMembership (lines 504-522) — pattern for transaction_tag
export const expenseGroupMembership = pgTable(
  "expense_group_membership",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => expenseGroup.id, { onDelete: "cascade" }),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("expense_group_membership_group_expense_unique").on(table.groupId, table.expenseId),
    unique("expense_group_membership_expense_unique").on(table.expenseId),
    index("expense_group_membership_groupId_idx").on(table.groupId),
    index("expense_group_membership_expenseId_idx").on(table.expenseId),
  ],
);
```

**Adapt for transaction_tag:**
- Replace `groupId` → `tagId` (references tag table)
- Replace `expenseId` → `transactionId` (references transaction table)
- Remove second unique (no "one tag per tx" constraint — many tags per tx allowed)
- Keep composite unique(tagId, transactionId) to prevent duplicate assignments
- Indexes: keep both for efficient lookups by tag and by transaction

---

### `lib/dal/tags.ts` (DAL, CRUD)

**Analog:** `lib/dal/categories.ts` (userId-scoped queries, IDOR pattern)

**Imports pattern (lines 1-8):**

```typescript
import 'server-only'
import { cache } from 'react'
import { db, type DbOrTx } from '@/lib/db'
import { verifySession } from '@/lib/dal/auth'
import { tag, transactionTag, transaction } from '@/lib/db/schema'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
```

**Core query pattern — userId-scoped with IDOR filter (categories.ts lines 66-158):**

```typescript
// Example: getTags by userId
export async function getTags(userId: string): Promise<Tag[]> {
  const rows = await db
    .select({
      id: tag.id,
      userId: tag.userId,
      name: tag.name,
      dateRangeStart: tag.dateRangeStart,
      dateRangeEnd: tag.dateRangeEnd,
      archived: tag.archived,
      createdAt: tag.createdAt,
    })
    .from(tag)
    .where(eq(tag.userId, userId))
    .orderBy(asc(tag.createdAt))
  
  return rows
}

// Single tag lookup with IDOR check
export async function getTag(userId: string, tagId: number): Promise<Tag | null> {
  const rows = await db
    .select()
    .from(tag)
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .limit(1)
  
  return rows[0] ?? null
}

// Tag-date-range lookup for suggestions (D-03 logic)
export async function getTagsByDateRange(userId: string): Promise<TagWithRange[]> {
  const rows = await db
    .select()
    .from(tag)
    .where(
      and(
        eq(tag.userId, userId),
        eq(tag.archived, false),
        // D-03: only tags with both start AND end dates are suggestion-eligible
        sql`${tag.dateRangeStart} IS NOT NULL AND ${tag.dateRangeEnd} IS NOT NULL`
      )
    )
  return rows
}

// Transaction tags (join table query)
export async function getTransactionTags(userId: string, transactionId: string) {
  return db
    .select({ tag: tag })
    .from(transactionTag)
    .innerJoin(transaction, eq(transactionTag.transactionId, transaction.id))
    .innerJoin(tag, eq(transactionTag.tagId, tag.id))
    .where(
      and(
        eq(transaction.userId, userId),  // IDOR: verify tx belongs to user
        eq(transactionTag.transactionId, transactionId)
      )
    )
}
```

**DbOrTx pattern (for seed/import transactions — categories.ts lines 160-178):**

```typescript
// All DAL functions accept optional DbOrTx for transaction participation
export async function createTag(
  input: { userId: string; name: string; ... },
  database: DbOrTx = db,
) {
  return database.insert(tag).values({...}).returning()
}
```

---

### `lib/services/tag-operations.ts` (service, CRUD)

**Analog:** `lib/dal/categories.ts` lines 160-178 (createUserCategory) + lines 46-64 (mapDuplicate error handling)

**Imports pattern:**

```typescript
import { db } from '@/lib/db'
import { getTag, getTags, createTag as createTagDAL } from '@/lib/dal/tags'
import type { DbOrTx } from '@/lib/db'
```

**Uniqueness guard pattern (D-02 — case-insensitive check):**

```typescript
// categories.ts lines 46-64: error handling for unique constraint violations
function isUniqueConflict(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505',
  )
}

async function mapDuplicate<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new TagMutationError('duplicate', 'Tag con questo nome esiste già')
    }
    throw error
  }
}

// Adapt for tags with case-insensitive normalization:
export async function createTag(input: {
  userId: string
  name: string
  dateRangeStart: Date | null
  dateRangeEnd: Date | null
}) {
  // D-02: normalize for uniqueness check (case + whitespace insensitive)
  const normalized = input.name.trim().toLowerCase()
  
  const existing = await getTags(input.userId)
  const isDuplicate = existing.some(
    t => t.name.trim().toLowerCase() === normalized
  )
  
  if (isDuplicate) {
    throw new TagMutationError('duplicate', 'Tag con questo nome esiste già')
  }
  
  return mapDuplicate(
    db.insert(tag).values({
      userId: input.userId,
      name: input.name,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning()
  )
}

// Similar for updateTag + archiveTag
export async function updateTag(
  userId: string,
  tagId: number,
  input: { name?: string; dateRangeStart?: Date | null; dateRangeEnd?: Date | null }
) {
  const existing = await getTag(userId, tagId)
  if (!existing) throw new TagMutationError('not_found', 'Tag non trovato')
  
  // D-02: validate new name against existing tags (skip self)
  if (input.name) {
    const normalized = input.name.trim().toLowerCase()
    const conflict = await getTags(userId).then(tags =>
      tags.some(
        t => t.id !== tagId && t.name.trim().toLowerCase() === normalized
      )
    )
    if (conflict) {
      throw new TagMutationError('duplicate', 'Tag con questo nome esiste già')
    }
  }
  
  return db
    .update(tag)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .returning()
}

export async function archiveTag(userId: string, tagId: number) {
  return db
    .update(tag)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(tag.id, tagId), eq(tag.userId, userId)))
    .returning()
}
```

**Error class (reusable pattern):**

```typescript
export type TagMutationErrorCode = 'not_found' | 'duplicate'

export class TagMutationError extends Error {
  constructor(
    public readonly code: TagMutationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TagMutationError'
  }
}
```

---

### `lib/services/import-tags.ts` (service, post-import suggestion logic)

**Analog:** `lib/services/import.ts` lines 689-705 (TRIG-01: post-commit, outside db.transaction)

**Post-commit pattern (TRIG-01, non-fatal workflow):**

```typescript
// import.ts lines 689-705: pattern for tag suggestions
// TRIG-01: run discovery post-commit (outside db.transaction — service contract forbids tx handle)
// Non-fatal: import is already committed; discovery failure must not throw.
let discoveryCount = 0
try {
  const platformId = await getPlatformIdForUserFile({ userId: input.userId, fileId: input.fileId })
  if (platformId != null) {
    const discovery = await discoverRegexCandidates({ userId: input.userId, scope: { platformId } })
    discoveryCount = discovery.candidates.length + discovery.singleCategorizationSuggestions.length
  }
} catch (err) {
  logger.warn({
    event: 'post_import_discovery_failed',
    message: err instanceof Error ? err.message : String(err),
    userId: input.userId,
    fileId: input.fileId,
  })
}

return { ...result, discoveryCount }
```

**Adapt for tag suggestions (new service, import-tags.ts):**

```typescript
import { getTags } from '@/lib/dal/tags'
import { getTransactionsByIds } from '@/lib/dal/transactions'
import logger from '@/lib/logger'

export async function computeTagSuggestions(input: {
  userId: string
  transactionIds: string[]  // newly imported from importFile()
  fileId: string
}): Promise<TagSuggestion[]> {
  try {
    const userTags = await getTags(input.userId)
    
    // D-03: filter to tags with date ranges only
    const tagsWithRange = userTags.filter(
      t => !t.archived && t.dateRangeStart && t.dateRangeEnd
    )
    
    if (tagsWithRange.length === 0) {
      return []  // no suggestions if user has no date-range tags
    }
    
    // Fetch newly imported transactions
    const txs = await getTransactionsByIds(input.userId, input.transactionIds)
    const suggestions: TagSuggestion[] = []
    
    // D-09: match rule = date within [start, end] inclusive
    for (const userTag of tagsWithRange) {
      const matching = txs.filter(tx =>
        tx.occurredAt >= userTag.dateRangeStart &&
        tx.occurredAt <= userTag.dateRangeEnd
      )
      
      if (matching.length === 0) continue
      
      // D-10: dedup — filter out transactions already tagged with this tag
      const alreadyTagged = await getTransactionTagsByTagAndIds(
        input.userId,
        userTag.id,
        matching.map(tx => tx.id)
      )
      const taggedSet = new Set(alreadyTagged.map(tt => tt.transactionId))
      
      const untagged = matching.filter(tx => !taggedSet.has(tx.id))
      
      if (untagged.length > 0) {
        suggestions.push({
          tagId: userTag.id,
          tagName: userTag.name,
          matchingTransactionIds: untagged.map(tx => tx.id),
          matchingCount: untagged.length,
        })
      }
    }
    
    return suggestions
  } catch (err) {
    // Non-fatal: log but don't throw
    logger.warn({
      event: 'post_import_tag_suggestions_failed',
      message: err instanceof Error ? err.message : String(err),
      userId: input.userId,
      fileId: input.fileId,
    })
    return []
  }
}
```

**In importFile() service (lib/services/import.ts), after db.transaction completes:**

```typescript
// After transaction commits (outside db.transaction block)
let tagSuggestions: TagSuggestion[] = []
try {
  tagSuggestions = await computeTagSuggestions({
    userId: input.userId,
    transactionIds: result.insertedTransactionIds,
    fileId: input.fileId,
  })
} catch (err) {
  logger.warn({
    event: 'post_import_tag_suggestions_failed',
    userId: input.userId,
    fileId: input.fileId,
  })
}

// Store for suggestions page to render
await updateFileImportState({
  fileId: input.fileId,
  tagSuggestionsComputed: tagSuggestions.length > 0,
})
```

---

### `lib/actions/tags.ts` (actions, request-response)

**Analog:** `lib/actions/transactions.ts` (verifySession + Zod + service call pattern)

**Pattern (transactions.ts lines 41-77):**

```typescript
'use server'

import { verifySession } from '@/lib/dal/auth'
import { createTransaction } from '@/lib/services/...'
import { CreateTransactionSchema } from '@/lib/validations/...'
import type { ActionState } from '@/lib/validations/expense'
import { revalidateCategorizationSurfaces } from '@/lib/actions/revalidation'

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateTransactionSchema.safeParse({
    description: formData.get('description'),
    amount: formData.get('amount'),
    // ...
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  
  const { userId } = await verifySession()
  
  try {
    await insertManualTransaction({ userId, ...parsed.data })
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

**Adapt for tag actions (lib/actions/tags.ts):**

```typescript
'use server'

import { verifySession } from '@/lib/dal/auth'
import {
  createTag as createTagService,
  updateTag as updateTagService,
  archiveTag as archiveTagService,
  bulkAssignTags,
  bulkRemoveTags,
} from '@/lib/services/tag-operations'
import {
  CreateTagSchema,
  UpdateTagSchema,
  BulkAssignTagsSchema,
} from '@/lib/validations/tags'
import type { ActionState } from '@/lib/validations/expense'
import { revalidatePath } from 'next/cache'

export async function createTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateTagSchema.safeParse({
    name: formData.get('name'),
    dateRangeStart: formData.get('dateRangeStart') || undefined,
    dateRangeEnd: formData.get('dateRangeEnd') || undefined,
  })
  
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  
  const { userId } = await verifySession()
  
  try {
    const newTag = await createTagService({
      userId,
      name: parsed.data.name,
      dateRangeStart: parsed.data.dateRangeStart ?? null,
      dateRangeEnd: parsed.data.dateRangeEnd ?? null,
    })
    
    revalidatePath('/settings/tags')
    return { error: null, tagId: newTag.id }
  } catch (error) {
    if (error instanceof TagMutationError) {
      return { error: error.message }
    }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}

export async function bulkAssignTagsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let transactionIds: unknown, tagIds: unknown
  
  try {
    transactionIds = JSON.parse(formData.get('transactionIds') as string ?? '[]')
    tagIds = JSON.parse(formData.get('tagIds') as string ?? '[]')
  } catch {
    return { error: 'Selezione non valida.' }
  }
  
  const parsed = BulkAssignTagsSchema.safeParse({
    transactionIds,
    tagIds,
    operation: formData.get('operation') ?? 'add',
  })
  
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  
  const { userId } = await verifySession()
  
  try {
    // D-06: additive union — add tags to whatever tx already carries
    await bulkAssignTags({
      userId,
      transactionIds: parsed.data.transactionIds,
      tagIds: parsed.data.tagIds,
    })
    
    revalidatePath('/transactions')
    return { error: null }
  } catch (error) {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
}
```

---

### `components/tags/tag-settings-panel.tsx` (component, CRUD UI)

**Analog:** `components/categories/category-settings-panel.tsx` (sidebar + detail layout)

**Structure pattern (category-settings-panel.tsx lines 38-88):**

- Client component with useState for selectedId
- Sidebar with category list grouped by type
- Detail pane with mutations (Create/Rename/Delete dialogs)
- Wraps in Card + CardHeader/Content

**Adapt for tags (simpler: no hierarchy):**

```typescript
"use client";

import { useState } from "react";
import type { Tag } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CreateTagDialog,
  EditTagDialog,
  ArchiveTagDialog,
} from "./tag-mutation-dialogs";

type Props = {
  tags: Tag[];
};

export function TagSettingsPanel({ tags }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  
  const selectedTag = selectedId ? tags.find(t => t.id === selectedId) : null;
  const activeTags = tags.filter(t => !t.archived);
  const archivedTags = tags.filter(t => t.archived);
  
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
      {/* Sidebar */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold mb-2">Tag attivi</h3>
        {activeTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun tag.</p>
        ) : (
          <nav className="flex flex-col gap-1">
            {activeTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedId(tag.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  selectedId === tag.id && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
          </nav>
        )}
        
        {archivedTags.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mt-4 mb-2">Archiviati</h3>
            <nav className="flex flex-col gap-1 opacity-60">
              {archivedTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedId(tag.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="truncate">{tag.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Archiviato
                  </Badge>
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
      
      {/* Detail pane */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle>
              {selectedTag ? selectedTag.name : 'Nessun tag selezionato'}
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              Nuovo tag
            </Button>
            {selectedTag && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  Modifica
                </Button>
                {!selectedTag.archived && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setArchiveOpen(true)}
                  >
                    Archivia
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        
        {selectedTag && (
          <CardContent>
            {/* Detail info */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Nome</p>
                <p className="text-sm">{selectedTag.name}</p>
              </div>
              {selectedTag.dateRangeStart && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Intervallo date</p>
                  <p className="text-sm">
                    {selectedTag.dateRangeStart.toLocaleDateString()} — {selectedTag.dateRangeEnd?.toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Dialogs */}
      <CreateTagDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selectedTag && (
        <>
          <EditTagDialog open={editOpen} onOpenChange={setEditOpen} tag={selectedTag} />
          <ArchiveTagDialog open={archiveOpen} onOpenChange={setArchiveOpen} tag={selectedTag} />
        </>
      )}
    </div>
  );
}
```

---

### `components/tags/bulk-assign-tags-dialog.tsx` (component, multi-select)

**Analog:** `components/expenses/bulk-categorize-dialog.tsx` + `components/categorization/subcategory-picker.tsx`

**BulkCategorizeDialog pattern (bulk-categorize-dialog.tsx lines 1-65):**

```typescript
'use client'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
import { bulkCategorize } from '@/lib/actions/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  onSuccess: (subCategoryId: string) => void
  successCount?: number
  successNoun?: string
}

export function BulkCategorizeDialog({
  open,
  onOpenChange,
  selectedIds,
  categories,
  mostUsed,
  onSuccess,
  successCount,
  successNoun = 'spese',
}: Props) {
  const [isPending, startTransition] = useTransition()

  function handleChange(subCategoryId: string) {
    const fd = new FormData()
    fd.set('ids', JSON.stringify(selectedIds))
    fd.set('subCategoryId', subCategoryId)

    startTransition(async () => {
      const result = await bulkCategorize({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        const count = successCount ?? selectedIds.length
        toast.success(`${count} ${successNoun} categorizzate.`)
        onSuccess(subCategoryId)
        onOpenChange(false)
      }
    })
  }

  return (
    <SubcategoryPicker
      open={open}
      onOpenChange={onOpenChange}
      categories={categories}
      mostUsed={mostUsed}
      allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
      defaultType={null}
      onChange={handleChange}
      pending={isPending}
    />
  )
}
```

**Adapt for multi-select tags (new BulkAssignTagsDialog):**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { bulkAssignTagsAction } from '@/lib/actions/tags'
import type { Tag } from '@/lib/db/schema'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionIds: string[]
  tags: Tag[]
  onSuccess: () => void
}

export function BulkAssignTagsDialog({
  open,
  onOpenChange,
  transactionIds,
  tags,
  onSuccess,
}: Props) {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()
  
  const activeTags = tags.filter(t => !t.archived)
  const archivedTags = tags.filter(t => t.archived)
  
  function handleConfirm() {
    if (selectedTagIds.length === 0) {
      toast.error('Seleziona almeno un tag.')
      return
    }
    
    const fd = new FormData()
    fd.set('transactionIds', JSON.stringify(transactionIds))
    fd.set('tagIds', JSON.stringify(selectedTagIds))
    fd.set('operation', 'add')
    
    startTransition(async () => {
      const result = await bulkAssignTagsAction({ error: null }, fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${selectedTagIds.length} tag assegnati a ${transactionIds.length} transazioni.`)
        onSuccess()
        onOpenChange(false)
        setSelectedTagIds([])
      }
    })
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assegna tag</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-64 border rounded-md p-4">
          <div className="space-y-2">
            {/* Active tags */}
            {activeTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
              >
                <Checkbox
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={(checked) => {
                    setSelectedTagIds(prev =>
                      checked
                        ? [...prev, tag.id]
                        : prev.filter(id => id !== tag.id)
                    )
                  }}
                  disabled={isPending}
                />
                <span className="text-sm">{tag.name}</span>
              </label>
            ))}
            
            {/* Archived tags (still selectable per D-04) */}
            {archivedTags.length > 0 && (
              <>
                <div className="pt-2 mt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Archiviati
                  </p>
                </div>
                {archivedTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer opacity-60"
                  >
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => {
                        setSelectedTagIds(prev =>
                          checked
                            ? [...prev, tag.id]
                            : prev.filter(id => id !== tag.id)
                        )
                      }}
                      disabled={isPending}
                    />
                    <span className="text-sm">{tag.name}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Archiviato
                    </Badge>
                  </label>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annulla
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || selectedTagIds.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assegnando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Assegna ({selectedTagIds.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### `components/transactions/transaction-bulk-action-bar.tsx` (extend)

**Analog:** same file (lines 1-49), existing pattern

**Add button to existing bar:**

```typescript
// Existing lines 33-44 (after Categorizza button)
<Button onClick={onBulkCategorize} disabled={!canBulkCategorize}>
  Categorizza ({count})
</Button>

// NEW: add between Categorizza and Delete
<Button onClick={onBulkAssignTags}>
  Assegna tag ({count})
</Button>

<Button type="button" size="sm" variant="destructive" onClick={onBulkDelete}>
  Elimina ({count})
</Button>
```

**Update props:**

```typescript
type Props = {
  selectedIds: string[]
  canBulkCategorize: boolean
  onBulkCategorize: () => void
  onBulkAssignTags: () => void  // NEW
  onBulkDelete: () => void
}
```

---

### `app/(app)/settings/tags/page.tsx` (RSC page)

**Analog:** `app/(app)/settings/categories/page.tsx` (lines 1-40)

**Pattern:**

```typescript
import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { CategorySettingsPanel } from '@/components/categories/category-settings-panel'

export const metadata = { title: 'Categorie' }

export default async function CategoriesPage() {
  const { userId, subscriptionPlan } = await verifySession()
  
  const categories = await getCategories()
  
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci la tua tassonomia personale...
        </p>
      </div>
      
      <CategorySettingsPanel categories={categories} />
    </div>
  )
}
```

**Adapt for tags:**

```typescript
import { verifySession } from '@/lib/dal/auth'
import { getTags } from '@/lib/dal/tags'
import { TagSettingsPanel } from '@/components/tags/tag-settings-panel'

export const metadata = { title: 'Tag' }

export default async function TagsPage() {
  const { userId } = await verifySession()
  
  const tags = await getTags(userId)
  
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea e gestisci i tag per organizzare le tue transazioni.
        </p>
      </div>
      
      <TagSettingsPanel tags={tags} />
    </div>
  )
}
```

---

### `app/(app)/import/[fileId]/suggestions/page.tsx` (extend)

**Analog:** same file (lines 1-59), render SuggestionSection

**Add tag suggestions block alongside pattern suggestions:**

```typescript
// Line 50-56: existing SuggestionSection
<SuggestionSection
  suggestions={discovery.candidates}
  singleSuggestions={discovery.singleCategorizationSuggestions}
  categories={categories}
  fileId={fileId}
/>

// NEW: add before or after SuggestionSection
import { TagSuggestionSection } from '@/components/import/tag-suggestion-section'
import { computeTagSuggestions } from '@/lib/services/import-tags'

// In the page component:
const tagSuggestions = await computeTagSuggestions({
  userId,
  transactionIds: result.insertedTransactionIds,  // from file import state
  fileId,
})

// Render:
{tagSuggestions.length > 0 && (
  <TagSuggestionSection
    suggestions={tagSuggestions}
    fileId={fileId}
  />
)}
```

---

### `scripts/seed-extras.ts` (extend — add Vacanze audit step)

**Analog:** same file (lines 63-100, reorganizeSpesaSubcategories step)

**Pattern for deactivation step:**

```typescript
// Step 3 (quick-260531): reorganize grocery category subcategories
async function reorganizeSpesaSubcategories(database: Db): Promise<void> {
  const existingBioNaturale = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'bio-e-naturale'), isNull(subCategory.userId)))
    .limit(1)
  
  if (existingBioNaturale.length > 0) {
    // Target already exists — deactivate old slug if still present
    const deactivateSpaeBio = await database
      .update(subCategory)
      .set({ isActive: false })
      .where(and(eq(subCategory.slug, 'spesa-bio'), isNull(subCategory.userId)))
    const deactivateCount = (deactivateSpaeBio as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`...deactivated spesa-bio: ${deactivateCount} rows`)
  }
  
  // 3. Migrate expenses before deactivating subcategories
  // ...move expenses to different subcategories...
}
```

**Adapt for Vacanze audit (D-11, D-12):**

```typescript
// Step N (phase-67-vacanze-audit): deactivate overlapping Vacanze subcategories + reset transactions
async function vacazeAudit(database: Db): Promise<void> {
  console.log('    vacanze-audit: deactivating attivita-e-intrattenimento, cibo-e-bevande...')
  
  // D-12: Reset transactions first, BEFORE deactivating subcategories
  // (per design: "correctness over convenience — reset to da-categorizzare so user re-assigns")
  
  // Find the uncategorized (da-categorizzare) subcategory
  const uncategorized = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(
      and(
        eq(subCategory.slug, 'da-categorizzare'),
        isNull(subCategory.userId)
      )
    )
    .limit(1)
  
  if (!uncategorized[0]) {
    console.log('    vacanze-audit: ERROR — da-categorizzare subcategory not found, aborting')
    return
  }
  
  // Reset transactions that were under the two removed subcategories
  const slugsToReset = ['attivita-e-intrattenimento', 'cibo-e-bevande']
  const deactivateSubcats = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(
      and(
        inArray(subCategory.slug, slugsToReset),
        isNull(subCategory.userId)
      )
    )
  
  const subcatIdsToReset = deactivateSubcats.map(sc => sc.id)
  
  if (subcatIdsToReset.length > 0) {
    const resetResult = await database
      .update(expense)
      .set({ subCategoryId: uncategorized[0].id })
      .where(inArray(expense.subCategoryId, subcatIdsToReset))
    
    const resetCount = (resetResult as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    vacanze-audit: reset ${resetCount} expenses to da-categorizzare`)
  }
  
  // Now deactivate the subcategories
  const deactivateResult = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(
      and(
        inArray(subCategory.slug, slugsToReset),
        isNull(subCategory.userId)
      )
    )
  
  const deactivateCount = (deactivateResult as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    vacanze-audit: deactivated ${deactivateCount} subcategories`)
}

// Add to STEPS array:
const STEPS = [
  setSubcategoryNature,
  setFinecoDescriptionStripPattern,
  reorganizeSpesaSubcategories,
  // ... existing steps ...
  vacazeAudit,  // NEW
]
```

---

### `scripts/seed-patterns-data.ts` (extend — trasporto pattern for D-14)

**Analog:** same file (lines 70-84, train/railway pattern)

**Pattern structure (SystemCategorizationPatternSeed):**

```typescript
export const systemCategorizationPatterns: SystemCategorizationPatternSeed[] = [
  {
    pattern: "(?:\\btrenitalia\\b|\\bitalo\\b|\\bfrecciarossa\\b|...)",
    subCategorySlug: "mezzi-pubblici",
    confidence: 0.95,
    priority: 5,
    description: "Railway services and trains",
  },
  // ... existing patterns ...
]
```

**Adapt for trasporto (D-14 — exclude daily commute, include travel transport):**

```typescript
// NEW: replace or refine existing trasporto entry
{
  pattern: 
    "(?:" +
    // Travel-specific transport (flights, long-distance, vacation context)
    "\\bflight|\\bal italia|\\bryanair|\\beasyjet|\\blufthan|\\bklm|\\bair france|\\bbritish airways|" +
    "\\brent[ao]\\b|\\brentals\\b|\\bcar rental|" +  // car rental companies
    "\\bhotels?\\b|\\bhotel.com|\\bairbnb|\\bcamping|\\bagriturismo|" +  // accommodation -> travel context
    "\\bferry|\\btraghetto|\\bcruise|" +  // sea/ferry travel
    "\\bvolo|\\bprenotazione volo|\\bgruppi" +
    // Exclude: daily commuting, regular transport
    // NOT: autobus, metro, treno without context, tram, pullman, pendolare
    "(?!.*(?:daily|pendolare|commut|abbonamento|mensile))" +
    ")",
  subCategorySlug: "trasporto",
  confidence: 0.85,
  priority: 15,
  description: "Travel-specific transport: flights, rental cars, ferries. Excludes daily commute (metro, bus, trains with abbonamento).",
},
```

---

## Shared Patterns

### IDOR + verifySession Pattern
**Apply to:** All DAL queries and service functions in `lib/dal/tags.ts` and `lib/services/tag-operations.ts`

All mutations must verify `userId` match before operating on tag/transaction data.

```typescript
// Standard pattern:
const { userId } = await verifySession()
const tag = await getTag(userId, tagId)
if (!tag) throw new TagMutationError('not_found', '...')
// Proceed with mutation
```

### Error Handling for Uniqueness (D-02)
**Apply to:** `lib/services/tag-operations.ts` createTag, updateTag

```typescript
// Catch unique constraint violations (PostgreSQL error code 23505)
function isUniqueConflict(error: unknown) {
  return error && typeof error === 'object' && (error as any).code === '23505'
}

// Rethrow as domain error
if (isUniqueConflict(error)) {
  throw new TagMutationError('duplicate', 'Tag con questo nome esiste già')
}
```

### Dedup in Tag Suggestions (D-10)
**Apply to:** `lib/services/import-tags.ts` computeTagSuggestions

For each tag with a date range, filter out transactions that already carry that tag before proposing.

### Archive-not-Delete Pattern (D-04)
**Apply to:** All tag deletion → archiveTag (flip archived flag, never hard delete)

Archived tags remain queryable and selectable in bulk-assign dialogs.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/validations/tags.ts` | validation | CRUD | Can derive from transactions.ts; straightforward Zod schemas |

---

## Metadata

**Analog search scope:** lib/dal/, lib/services/, lib/actions/, components/, app/(app)/, scripts/
**Files scanned:** 40+ source files + schema
**Pattern extraction date:** 2026-07-20

**High-confidence analogs:**
- Schema N:N join: expenseGroupMembership (exact match, 100% transferable)
- DAL + IDOR: categories.ts (exact match, proven pattern)
- Post-import workflow: import.ts TRIG-01 (exact match, lines 689-705)
- Server actions: transactions.ts (exact match, proven pattern)
- Bulk UI: bulk-categorize-dialog.tsx (exact match, reusable)
- Seed steps: seed-extras.ts (exact match, idempotent pattern)

---

*Phase: 67-tags-foundation-and-assignment*
*Pattern mapping completed: 2026-07-20*
