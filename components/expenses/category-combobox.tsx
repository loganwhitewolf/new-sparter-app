'use client'

import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

// ---------------------------------------------------------------------------
// Option model
// ---------------------------------------------------------------------------

export type CategoryOption = {
  /** Subcategory id — used as the form value */
  value: string
  /** Displayed label (overridden name or original name) */
  label: string
  /** Original/system name — used as secondary search target */
  originalName: string
  /** Category name this subcategory belongs to */
  categoryName: string
  /** Slug for additional search matching */
  slug: string
  /** Whether the subcategory belongs to the current user */
  isOwned: boolean
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Flatten a CategoryWithSubCategories tree into selectable options.
 * Pass `allowedCategoryTypes` to filter to specific category types.
 */
export function buildCategoryOptions(
  categories: CategoryWithSubCategories[],
  allowedCategoryTypes?: Array<CategoryWithSubCategories['type']>,
): CategoryOption[] {
  const filtered = allowedCategoryTypes
    ? categories.filter((c) => allowedCategoryTypes.includes(c.type))
    : categories

  return filtered.flatMap((cat) =>
    cat.subCategories.map((sub) => ({
      value: String(sub.id),
      label: sub.name,
      originalName: sub.originalName,
      categoryName: cat.name,
      slug: sub.slug,
      isOwned: sub.isOwned,
    })),
  )
}

/**
 * Filter options by free text across:
 *   - display name (label)
 *   - original name
 *   - category name
 *   - slug
 *
 * Returns all options when `query` is empty/whitespace.
 */
export function filterCategoryOptions(
  options: CategoryOption[],
  query: string,
): CategoryOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      o.originalName.toLowerCase().includes(q) ||
      o.categoryName.toLowerCase().includes(q) ||
      o.slug.toLowerCase().includes(q),
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  categories: CategoryWithSubCategories[]
  /** Current selected subcategory id (string) */
  value: string
  /** Called with the subcategory id string when selection changes */
  onChange: (value: string) => void
  /** Button placeholder text */
  placeholder?: string
  disabled?: boolean
  /**
   * Restrict selectable categories by type.
   * Pass `['out', 'system']` for expense-only pickers (excludes 'in' income categories).
   */
  allowedCategoryTypes?: Array<CategoryWithSubCategories['type']>
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
  placeholder = 'Seleziona una sottocategoria',
  disabled = false,
  allowedCategoryTypes,
}: Props) {
  const [open, setOpen] = React.useState(false)

  const options = React.useMemo(
    () => buildCategoryOptions(categories, allowedCategoryTypes),
    [categories, allowedCategoryTypes],
  )

  const selectedOption = options.find((o) => o.value === value)

  // Group options by category name for display
  const groupedOptions = React.useMemo(() => {
    const groups = new Map<string, CategoryOption[]>()
    for (const opt of options) {
      const existing = groups.get(opt.categoryName)
      if (existing) {
        existing.push(opt)
      } else {
        groups.set(opt.categoryName, [opt])
      }
    }
    return groups
  }, [options])

  function handleSelect(selectedValue: string) {
    onChange(selectedValue === value ? '' : selectedValue)
    setOpen(false)
  }

  const buttonLabel = selectedOption ? (
    <span className="flex items-center gap-2 truncate">
      <span className="truncate">{selectedOption.label}</span>
      <span className="text-muted-foreground text-xs shrink-0">{selectedOption.categoryName}</span>
    </span>
  ) : (
    <span className="text-muted-foreground">{placeholder}</span>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {buttonLabel}
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const opt = options.find((o) => o.value === itemValue)
            if (!opt) return 0
            const q = search.toLowerCase()
            if (
              opt.label.toLowerCase().includes(q) ||
              opt.originalName.toLowerCase().includes(q) ||
              opt.categoryName.toLowerCase().includes(q) ||
              opt.slug.toLowerCase().includes(q)
            ) {
              return 1
            }
            return 0
          }}
        >
          <CommandInput placeholder="Cerca categoria…" />
          <CommandList>
            <CommandEmpty>Nessuna sottocategoria trovata.</CommandEmpty>
            {Array.from(groupedOptions.entries()).map(([categoryName, opts]) => (
              <CommandGroup key={categoryName} heading={categoryName}>
                {opts.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={handleSelect}
                  >
                    <CheckIcon
                      className={cn(
                        'mr-2 size-4 shrink-0',
                        value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.isOwned && (
                      <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                        Personale
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
