'use client'

/**
 * SubcategoryPicker — productionized variant E of the unified subcategory picker.
 *
 * Container: Sheet + SheetContent side="bottom" (Radix UI, @/components/ui/sheet).
 * Fixed height: ~80vh on mobile, ~600px on desktop. The sheet NEVER resizes when
 * switching type or filtering — only the inner columns scroll.
 *
 * Output: a single subCategoryId string via onChange; the caller decides
 * whether to commit immediately or fill a form field (D-07).
 */

import * as React from 'react'
import { ArrowLeft, Search, Star, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  buildCategoryOptions,
  filterCategoryOptions,
  type CategoryOption,
} from '@/lib/categorization/subcategory-options'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { MostUsedSubcategory } from '@/lib/dal/subcategory-usage'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TypeKey = CategoryWithSubCategories['type']
type FilterKey = TypeKey | null

export interface SubcategoryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Full category tree, already user-scoped (from getCategories). */
  categories: CategoryWithSubCategories[]
  /**
   * Most-used subcategories for the current user, already scoped to the
   * call site's allowed types (from getMostUsedSubcategories).
   * Empty array = hide "Più usate" section (cold-start / onboarding).
   */
  mostUsed: MostUsedSubcategory[]
  /** Category types visible to this call site. */
  allowedCategoryTypes: Array<TypeKey>
  /**
   * Pre-selected type chip derived from the row's amount sign.
   * null → "Tutte" chip selected.
   */
  defaultType: 'in' | 'out' | 'transfer' | null
  /** Called with the string subCategoryId when the user taps a tile. */
  onChange: (subCategoryId: string) => void
}

// ---------------------------------------------------------------------------
// Type chip definitions — no "system" chip (D-03)
// ---------------------------------------------------------------------------

const TYPE_FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: null, label: 'Tutte' },
  { key: 'in', label: 'Entrate' },
  { key: 'out', label: 'Uscite' },
  { key: 'transfer', label: 'Trasferimenti' },
]

// ---------------------------------------------------------------------------
// SubcategoryPicker — main export
// ---------------------------------------------------------------------------

export function SubcategoryPicker({
  open,
  onOpenChange,
  categories,
  mostUsed,
  allowedCategoryTypes,
  defaultType,
  onChange,
}: SubcategoryPickerProps) {
  const options = React.useMemo(
    () => buildCategoryOptions(categories, allowedCategoryTypes),
    [categories, allowedCategoryTypes],
  )

  const handleSelect = React.useCallback(
    (subCategoryId: string) => {
      onChange(subCategoryId)
      onOpenChange(false)
    },
    [onChange, onOpenChange],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        Fixed height: h-[80vh] on mobile, sm:h-[600px] on desktop.
        Never max-h (which would grow/shrink with content and cause jitter).
        Desktop: centered, constrained width, still bottom-anchored.
      */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex h-[80vh] flex-col overflow-hidden rounded-t-2xl p-0 sm:h-[600px] sm:max-w-lg"
      >
        {/* Drag handle visual */}
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />

        {/* Sheet header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3 gap-1.5">
          <SheetTitle className="text-sm font-semibold">Categorizza</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Chiudi"
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>

        {/* Body — filled in Task 2 */}
        <PickerBody
          options={options}
          categories={categories}
          mostUsed={mostUsed}
          allowedCategoryTypes={allowedCategoryTypes}
          defaultType={defaultType}
          onSelect={handleSelect}
        />
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// PickerBody — placeholder until Task 2 (compiles but shows nothing)
// ---------------------------------------------------------------------------

interface PickerBodyProps {
  options: CategoryOption[]
  categories: CategoryWithSubCategories[]
  mostUsed: MostUsedSubcategory[]
  allowedCategoryTypes: Array<TypeKey>
  defaultType: FilterKey
  onSelect: (subCategoryId: string) => void
}

function PickerBody({
  options,
  categories,
  mostUsed,
  allowedCategoryTypes,
  defaultType,
  onSelect,
}: PickerBodyProps) {
  const [query, setQuery] = React.useState('')
  const [type, setType] = React.useState<FilterKey>(defaultType ?? null)
  const [active, setActive] = React.useState<'most' | number | null>('most')

  // Reset active rail item when type chip changes
  const handleTypeChange = (key: FilterKey) => {
    setType(key)
    setActive('most')
  }

  // Categories visible in the left rail for the active type filter
  const rail = React.useMemo(
    () =>
      categories.filter((c) => {
        if (!allowedCategoryTypes.includes(c.type)) return false
        if (!type) return true
        return c.type === type
      }),
    [categories, allowedCategoryTypes, type],
  )

  // Most-used filtered by active type chip
  const usedFiltered = React.useMemo(
    () =>
      type
        ? mostUsed.filter((mu) => {
            // Resolve the category type for this mostUsed entry from options
            const opt = options.find((o) => o.value === String(mu.subCategoryId))
            return opt?.categoryType === type
          })
        : mostUsed,
    [mostUsed, options, type],
  )

  // Flat search results (non-empty query → collapse to flat list)
  const flatResults = React.useMemo(() => {
    if (!query) return null
    const searched = filterCategoryOptions(options, query)
    return type ? searched.filter((o) => o.categoryType === type) : searched
  }, [options, query, type])

  // Right-pane detail for the active rail item
  const detail = React.useMemo((): CategoryOption[] => {
    if (active === 'most') {
      // Map MostUsedSubcategory → CategoryOption via the built options
      return usedFiltered
        .map((mu) => options.find((o) => o.value === String(mu.subCategoryId)))
        .filter((o): o is CategoryOption => Boolean(o))
    }
    if (typeof active === 'number') {
      const cat = categories.find((c) => c.id === active)
      if (!cat) return []
      return options.filter((o) => o.categoryName === cat.name)
    }
    return []
  }, [active, usedFiltered, options, categories])

  return (
    <div className="flex min-h-0 flex-col flex-1">
      {/* Search + type chips */}
      <div className="flex flex-col gap-3 border-b p-3">
        <SearchInput value={query} onChange={setQuery} />
        <TypeChips active={type} onChange={handleTypeChange} />
      </div>

      {/* Flat search results */}
      {flatResults ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <TileList>
            {flatResults.length === 0 && <Empty />}
            {flatResults.map((o) => (
              <Tile
                key={o.value}
                title={o.label}
                hint={o.categoryName}
                isOwned={o.isOwned}
                onClick={() => onSelect(o.value)}
              />
            ))}
          </TileList>
        </div>
      ) : (
        /* Two-column master-detail (D-04) */
        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[190px_1fr]">
          {/* Left rail — hidden on mobile when a rail item is active */}
          <div
            className={cn(
              'min-h-0 overflow-y-auto border-r p-1.5',
              active !== null && 'hidden sm:block',
            )}
          >
            <RailItem
              icon
              active={active === 'most'}
              onClick={() => setActive('most')}
            >
              Più usate
            </RailItem>
            {rail.map((c) => (
              <RailItem
                key={c.id}
                active={active === c.id}
                onClick={() => setActive(c.id)}
              >
                {c.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {c.subCategories.length}
                </span>
              </RailItem>
            ))}
          </div>

          {/* Right pane — hidden on mobile when no rail item is active */}
          <div
            className={cn(
              'min-h-0 overflow-y-auto p-2',
              active === null && 'hidden sm:block',
            )}
          >
            {/* Mobile back button */}
            <button
              onClick={() => setActive(null)}
              className="mb-1 flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground sm:hidden"
            >
              <ArrowLeft className="size-3" /> Categorie
            </button>

            <TileList>
              {detail.length === 0 && <Empty />}
              {detail.map((o) => (
                <Tile
                  key={o.value}
                  title={o.label}
                  hint={
                    active === 'most'
                      ? o.categoryName
                      : o.isOwned
                        ? undefined
                        : undefined
                  }
                  isOwned={o.isOwned}
                  showCategoryHint={active === 'most'}
                  onClick={() => onSelect(o.value)}
                />
              ))}
            </TileList>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function TypeChips({
  active,
  onChange,
}: {
  active: FilterKey
  onChange: (k: FilterKey) => void
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {TYPE_FILTERS.map((t) => (
        <Chip key={t.label} active={active === t.key} onClick={() => onChange(t.key)}>
          {t.label}
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-xs',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-background hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function RailItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm',
        active ? 'bg-muted font-medium' : 'hover:bg-muted/60',
      )}
    >
      {icon && <Star className="size-3.5 text-primary" />}
      {children}
    </button>
  )
}

function TileList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>
}

function Tile({
  title,
  hint,
  isOwned,
  showCategoryHint,
  onClick,
}: {
  title: string
  hint?: string
  isOwned: boolean
  showCategoryHint?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition',
        'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm',
        'bg-card',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {/* Show category name hint for "Più usate" items */}
        {showCategoryHint && hint && (
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      {/* "Personale" badge for user-owned subcategories (D-05) */}
      {isOwned && (
        <Badge variant="secondary" className="shrink-0 text-xs">
          Personale
        </Badge>
      )}
    </button>
  )
}

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cerca sottocategoria…"
        className="pl-8"
      />
    </div>
  )
}

function Empty() {
  return (
    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
      Nessuna sottocategoria trovata.
    </p>
  )
}
