'use client'

/**
 * DataTableToolbar — shared, config-driven toolbar (Variant A, LOCKED).
 *
 * Layout:
 *   1. Inline search <Input> (when config.search is non-null), debounced 500ms
 *   2. "Filtri (n)" <Popover> trigger — count = active non-search filter params
 *   3. <PopoverContent> renders one control per config.filters entry
 *   4. <ChipsRow> below, one chip per active filter param, "Cancella tutto" batch-clears
 *   5. Desktop sort exposed via useToolbarSort() + HeaderSortButton (caller wires)
 *   6. Mobile "Ordina" <Button> + <Sheet side="bottom"> listing sortable columns
 *   7. Mobile "Filtri" <Sheet side="bottom"> mirrors the popover filter fields
 *
 * All state lives in the URL via useTableUrl(route); zero server state in this component.
 */

import { useState, useRef, useEffect } from 'react'

const SEARCH_DEBOUNCE_MS = 500
import { SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AmountRangePicker } from '@/components/data-table/AmountRangePicker'
import { ChipsRow } from '@/components/data-table/ChipsRow'
import { nextSort } from '@/components/data-table/HeaderSortButton'
import { monthLabel, MonthMultiPicker } from '@/components/data-table/MonthMultiPicker'
import { useTableUrl } from '@/components/data-table/use-table-url'
import type { FilterField, TableConfig } from '@/lib/utils/table-config'

// ---- Types -----------------------------------------------------------------

/**
 * dependentOptions: childFieldKey → parentUrlValue → option list.
 * The '' key is the all-bucket (used when the parent param is absent).
 * Built server-side (e.g. from buildDirectionNatureMap / buildCategorySubcategoryMap)
 * and passed through to FilterPanel → FilterField.
 */
type DependentOptions = Record<string, Record<string, { value: string; label: string }[]>>

type Props = {
  config: TableConfig
  route: string
  monthsWithData?: string[]
  filterOptions?: Record<string, { value: string; label: string }[]>
  dependentOptions?: DependentOptions
}

// ---- Filter count helper ---------------------------------------------------

/**
 * Count active filter params from URLSearchParams.
 * Excludes: 'q' (search), 'sort', 'dir'.
 * amount-range fields map to amountMin / amountMax (either present counts as 1 active filter).
 */
function countActiveFilters(searchParams: URLSearchParams, filters: FilterField[]): number {
  let count = 0
  for (const field of filters) {
    const key = field.key
    if (key === 'q' || key === 'sort' || key === 'dir') continue
    if (field.type === 'amount-range') {
      // amount-range is active when amountMin or amountMax is set
      if (searchParams.has('amountMin') || searchParams.has('amountMax')) count++
    } else {
      if (searchParams.has(key)) count++
    }
  }
  return count
}

// ---- Filter field renderer -------------------------------------------------

function FilterField({
  field,
  value,
  options,
  monthsWithData,
  searchParams,
  onChange,
  onParamChange,
  dependentOptions,
}: {
  field: FilterField
  value: string | null
  options?: { value: string; label: string }[]
  monthsWithData?: string[]
  searchParams: URLSearchParams
  onChange: (v: string | null) => void
  onParamChange: (key: string, v: string | null) => void
  dependentOptions?: DependentOptions
}) {
  if (field.type === 'select' || field.type === 'multi-select') {
    // Cascade-aware option resolution: if this field has a parent (dependsOn), resolve
    // options from the parent's current URL value. Fall back to '' all-bucket when absent.
    let resolvedOptions: { value: string; label: string }[]
    if (field.dependsOn && dependentOptions?.[field.key]) {
      const parentValue = searchParams.get(field.dependsOn) ?? ''
      resolvedOptions =
        dependentOptions[field.key][parentValue] ??
        dependentOptions[field.key][''] ??
        options ??
        field.options ??
        []
    } else {
      resolvedOptions = options ?? field.options ?? []
    }
    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        <Select
          value={value ?? 'all'}
          onValueChange={(v) => onChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {resolvedOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.type === 'status') {
    // Use custom options when provided (e.g. 3-bucket processing status for Files)
    // Fall back to the default 2-state categorization options for Transactions/Expenses
    const statusOptions = field.options ?? [
      { value: 'categorized', label: 'Categorizzate' },
      { value: 'uncategorized', label: 'Da categorizzare' },
    ]
    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        <Select
          value={value ?? 'all'}
          onValueChange={(v) => onChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        <Input
          value={value ?? ''}
          placeholder={field.label}
          onChange={(e) => onChange(e.currentTarget.value || null)}
        />
      </div>
    )
  }

  if (field.type === 'month-multi') {
    const selectedMonths = searchParams.get('months')?.split(',').filter(Boolean) ?? []
    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        <MonthMultiPicker
          value={selectedMonths}
          monthsWithData={monthsWithData ?? []}
          onChange={(m) => onParamChange('months', m.length ? m.join(',') : null)}
        />
      </div>
    )
  }

  if (field.type === 'amount-range') {
    return (
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        <AmountRangePicker
          min={searchParams.get('amountMin') ?? ''}
          max={searchParams.get('amountMax') ?? ''}
          onMin={(v) => onParamChange('amountMin', v || null)}
          onMax={(v) => onParamChange('amountMax', v || null)}
        />
      </div>
    )
  }

  return null
}

// ---- Filter panel (shared between Popover and Sheet) ----------------------

function FilterPanel({
  config,
  searchParams,
  filterOptions,
  monthsWithData,
  updateParam,
  updateParams,
  dependentOptions,
}: {
  config: TableConfig
  searchParams: URLSearchParams
  filterOptions?: Record<string, { value: string; label: string }[]>
  monthsWithData?: string[]
  updateParam: (key: string, value: string | null) => void
  updateParams: (entries: Record<string, string | null>) => void
  dependentOptions?: DependentOptions
}) {
  /**
   * Cascade-aware onChange for parent fields.
   * When a field K is changed, clear any dependent children whose current value
   * is not present in the newly-resolved option set for the new parent value.
   * Parent + child clear happen in one URL write (avoids a stale intermediate render).
   */
  function handleFieldChange(field: FilterField, newValue: string | null) {
    // Find children that depend on this field
    const dependentChildren = config.filters.filter(
      (f) => f.dependsOn === field.key,
    )

    if (dependentChildren.length === 0 || !dependentOptions) {
      // No children — simple single-key write
      updateParam(field.key, newValue)
      return
    }

    // Build the multi-key update: parent value + any invalidated child clears
    const entries: Record<string, string | null> = { [field.key]: newValue }

    for (const child of dependentChildren) {
      const currentChildValue = searchParams.get(child.key)
      if (!currentChildValue) continue

      // Resolve the child options for the new parent value
      const parentValue = newValue ?? ''
      const childOpts =
        dependentOptions[child.key]?.[parentValue] ??
        dependentOptions[child.key]?.[''] ??
        child.options ??
        []

      const childValueValid = childOpts.some((o) => o.value === currentChildValue)
      if (!childValueValid) {
        entries[child.key] = null
      }
    }

    updateParams(entries)
  }

  return (
    <div className="space-y-3">
      {config.filters.map((field) => (
        <FilterField
          key={field.key}
          field={field}
          value={searchParams.get(field.key)}
          options={filterOptions?.[field.key]}
          monthsWithData={monthsWithData}
          searchParams={searchParams}
          onChange={(v) => handleFieldChange(field, v)}
          onParamChange={updateParam}
          dependentOptions={dependentOptions}
        />
      ))}
    </div>
  )
}

// ---- Main component --------------------------------------------------------

export function DataTableToolbar({ config, route, monthsWithData, filterOptions, dependentOptions }: Props) {
  const { searchParams, isPending, updateParam, updateParams } = useTableUrl(route)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchKey = config.search?.key ?? 'q'
  const urlSearchValue = config.search ? (searchParams.get(searchKey) ?? '') : ''
  const [searchDraft, setSearchDraft] = useState(urlSearchValue)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

  useEffect(() => {
    setSearchDraft(urlSearchValue)
  }, [urlSearchValue])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Active filter count (excludes q/sort/dir)
  const activeCount = countActiveFilters(searchParams, config.filters)

  // Build chips from active filter params.
  // month-multi: one chip per selected YYYY-MM, displayed as "Mag 2026" via monthLabel.
  // amount-range: single chip from amountMin and/or amountMax.
  const chips = config.filters
    .filter((field) => {
      if (field.type === 'amount-range') {
        return searchParams.has('amountMin') || searchParams.has('amountMax')
      }
      const v = searchParams.get(field.key)
      return v !== null && v !== ''
    })
    .flatMap((field) => {
      const raw = searchParams.get(field.key)!
      if (field.type === 'month-multi') {
        const months = raw.split(',').filter(Boolean)
        // Produce one chip per month for granular removal
        return months.map((ym) => ({
          key: `months:${ym}`,
          label: monthLabel(ym),
          onRemove: () => {
            const remaining = months.filter((m) => m !== ym)
            updateParam('months', remaining.length ? remaining.join(',') : null)
          },
        }))
      }
      if (field.type === 'amount-range') {
        // amount-range is spread across amountMin/amountMax — emit one chip per set value
        const chips: { key: string; label: string; onRemove: () => void }[] = []
        const min = searchParams.get('amountMin')
        const max = searchParams.get('amountMax')
        if (min) chips.push({ key: 'amountMin', label: `Min ${min} €`, onRemove: () => updateParam('amountMin', null) })
        if (max) chips.push({ key: 'amountMax', label: `Max ${max} €`, onRemove: () => updateParam('amountMax', null) })
        return chips
      }
      return [{ key: field.key, label: field.toChip(raw), onRemove: () => updateParam(field.key, null) }]
    })

  // "Cancella tutto": clear all filter keys (including q) in one write.
  // amount-range fields map to amountMin/amountMax — clear both.
  function clearAllFilters() {
    const entries: Record<string, null> = {}
    if (config.search) {
      entries[config.search.key] = null
    }
    for (const field of config.filters) {
      if (field.type === 'amount-range') {
        entries['amountMin'] = null
        entries['amountMax'] = null
      } else {
        entries[field.key] = null
      }
    }
    updateParams(entries)
  }

  // Search: local draft + debounced URL commit (avoids remount/focus loss on each keystroke)
  function handleSearchChange(value: string) {
    setSearchDraft(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const committed = value.trim() || null
      const current = searchParams.get(searchKey)
      if ((committed ?? '') === (current ?? '')) return
      updateParam(searchKey, committed)
    }, SEARCH_DEBOUNCE_MS)
  }

  // Current sort state
  const activeSort = searchParams.get('sort') ?? undefined
  const activeDir = (searchParams.get('dir') ?? 'desc') as 'asc' | 'desc'

  // Mobile sort handler
  function handleMobileSort(key: string) {
    const next = nextSort({ sort: activeSort, dir: activeDir }, key)
    updateParams({
      sort: next.sort ?? null,
      dir: next.dir ?? null,
    })
    setSortSheetOpen(false)
  }

  return (
    <div className="space-y-2">
      {/* Row 1: search + Filtri button */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input (desktop + mobile) */}
        {config.search && (
          <Input
            type="search"
            placeholder={config.search.placeholder}
            value={searchDraft}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            className="min-w-[200px] flex-1"
          />
        )}

        {/* Desktop: Filtri Popover (controlled for explicit close button) */}
        <div className="hidden md:flex items-center gap-2">
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                <SlidersHorizontal className="h-4 w-4" />
                {activeCount > 0 ? `Filtri (${activeCount})` : 'Filtri'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              {/* Popover header with title and explicit close button */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Filtri</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setFilterPopoverOpen(false)}
                  aria-label="Chiudi filtri"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FilterPanel
                config={config}
                searchParams={searchParams}
                filterOptions={filterOptions}
                monthsWithData={monthsWithData}
                updateParam={updateParam}
                updateParams={updateParams}
                dependentOptions={dependentOptions}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Mobile: Filtri Sheet trigger (hidden on md+) */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => setFilterSheetOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 ? `Filtri (${activeCount})` : 'Filtri'}
          </Button>

          {/* Mobile Ordina trigger */}
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => setSortSheetOpen(true)}
            aria-label="Ordina"
          >
            <ArrowUpDown className="h-4 w-4" />
            Ordina
          </Button>
        </div>
      </div>

      {/* Row 2: active filter chips */}
      <ChipsRow chips={chips} onClear={clearAllFilters} />

      {/* Mobile filter sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtri</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FilterPanel
              config={config}
              searchParams={searchParams}
              filterOptions={filterOptions}
              monthsWithData={monthsWithData}
              updateParam={updateParam}
              updateParams={updateParams}
              dependentOptions={dependentOptions}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile sort sheet */}
      <Sheet open={sortSheetOpen} onOpenChange={setSortSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Ordina</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-2">
            {config.sortable.map((col) => {
              const isActive = activeSort === col.key
              return (
                <button
                  key={col.key}
                  onClick={() => handleMobileSort(col.key)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className={isActive ? 'font-semibold' : ''}>{col.label}</span>
                  {isActive && (
                    <span className="text-xs text-muted-foreground">
                      {activeDir === 'asc' ? '↑ Crescente' : '↓ Decrescente'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---- Exported sort hook helper (for desktop HeaderSortButton wiring) -------

/**
 * useToolbarSort — returns the current sort state + an onSort handler that
 * implements the ASC→DESC→off cycle via updateParams.
 * To be consumed by the page-level component alongside HeaderSortButton.
 */
export function useToolbarSort(route: string) {
  const { searchParams, updateParams } = useTableUrl(route)
  const activeSort = searchParams.get('sort') ?? undefined
  const activeDir = (searchParams.get('dir') ?? 'desc') as 'asc' | 'desc'

  function onSort(key: string) {
    const next = nextSort({ sort: activeSort, dir: activeDir }, key)
    updateParams({
      sort: next.sort ?? null,
      dir: next.dir ?? null,
    })
  }

  return { activeSort, activeDir, onSort }
}
