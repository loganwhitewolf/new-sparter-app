/**
 * Cascade-options utility — derives dependent-select option maps from the taxonomy.
 *
 * Pure functions: no server-only imports, no side effects. Safe to import in tests
 * and client components.
 *
 * Convention: the all-bucket (parent unset) is stored under the '' (empty-string) key.
 * Pages pass dependentOptions[childKey][''] as the fallback when the parent param is absent.
 */

import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { NATURE_ORDER, NATURE_LABELS } from '@/lib/utils/nature-labels'

/** Shared filter option shape (value + display label). */
export type FilterOption = { value: string; label: string }

/** Shared inner helper — builds ordered FilterOption array from a set of nature codes. */
function buildNatureOptions(natureSet: Set<string>): FilterOption[] {
  const ordered: FilterOption[] = NATURE_ORDER
    .filter((n): n is NonNullable<typeof n> => n !== null && natureSet.has(n))
    .map((n) => ({
      value: n,
      label: NATURE_LABELS[n] ?? n,
    }))
  // Always append 'unclassified' as the last option
  ordered.push({ value: 'unclassified', label: NATURE_LABELS.unclassified })
  return ordered
}

/**
 * Derives, per direction code ('in' | 'out' | 'allocation' | 'transfer'), the distinct
 * natures used by that direction's subcategories. Returns option arrays ordered by
 * NATURE_ORDER, with 'unclassified' appended last. system-type categories are excluded;
 * null-type categories (no direction assigned yet) are skipped without error.
 *
 * Also emits an all-bucket under the '' key containing natures from all non-system directions.
 *
 * @param categories - Full taxonomy from getCategories()
 * @returns Record<string, FilterOption[]> keyed by direction code + '' (all-bucket)
 */
export function buildDirectionNatureMap(
  categories: CategoryWithSubCategories[],
): Record<string, FilterOption[]> {
  if (categories.length === 0) return {}

  // Collect distinct natures per direction code (excluding system; skipping null)
  const naturesPerDirection = new Map<string, Set<string>>()
  const allNatures = new Set<string>()

  for (const cat of categories) {
    // Skip unassigned (null) direction — 'system' was removed from the type union in Plan 03
    if (cat.type === null) continue

    if (!naturesPerDirection.has(cat.type)) {
      naturesPerDirection.set(cat.type, new Set())
    }
    const bucket = naturesPerDirection.get(cat.type)!

    for (const sub of cat.subCategories) {
      const nature = sub.effectiveNature
      if (nature !== null) {
        bucket.add(nature)
        allNatures.add(nature)
      }
    }
  }

  if (naturesPerDirection.size === 0) return {}

  // Build ordered option arrays per direction
  const result: Record<string, FilterOption[]> = {}

  // Per-direction buckets
  for (const [direction, natureSet] of naturesPerDirection.entries()) {
    result[direction] = buildNatureOptions(natureSet)
  }

  // All-bucket: union of all non-system direction natures
  result[''] = buildNatureOptions(allNatures)

  return result
}

/**
 * Derives, per category.type ('in' | 'out' | 'transfer'), the distinct natures used
 * by that type's subcategories. Returns option arrays ordered by NATURE_ORDER, with
 * 'unclassified' appended last. null-type categories (no direction assigned yet) are excluded.
 *
 * Also emits an all-bucket under the '' key containing natures from all non-null types.
 *
 * @param categories - Full taxonomy from getCategories()
 * @returns Record<string, FilterOption[]> keyed by category.type + '' (all-bucket)
 *
 * @deprecated Use buildDirectionNatureMap instead (direction codes replace category.type).
 */
export function buildTypeNatureMap(
  categories: CategoryWithSubCategories[],
): Record<string, FilterOption[]> {
  if (categories.length === 0) return {}

  // Collect distinct natures per type (excluding null)
  const naturesPerType = new Map<string, Set<string>>()
  const allNatures = new Set<string>()

  for (const cat of categories) {
    // Skip uncategorized (type null means no direction assigned yet)
    if (cat.type === null) continue

    if (!naturesPerType.has(cat.type)) {
      naturesPerType.set(cat.type, new Set())
    }
    const bucket = naturesPerType.get(cat.type)!

    for (const sub of cat.subCategories) {
      const nature = sub.effectiveNature
      if (nature !== null) {
        bucket.add(nature)
        allNatures.add(nature)
      }
    }
  }

  if (naturesPerType.size === 0) return {}

  // Build ordered option arrays per type
  const result: Record<string, FilterOption[]> = {}

  // Per-type buckets
  for (const [type, natureSet] of naturesPerType.entries()) {
    result[type] = buildNatureOptions(natureSet)
  }

  // All-bucket: union of all non-null types natures
  result[''] = buildNatureOptions(allNatures)

  return result
}

/**
 * Derives, per category.slug, the subcategory options for that category.
 * Each option has value = String(subCategory.id) and label = effective name.
 * null-type categories (no direction assigned) are excluded.
 *
 * Also emits an all-bucket under the '' key containing all subcategories from
 * non-system categories.
 *
 * @param categories - Full taxonomy from getCategories()
 * @returns Record<string, FilterOption[]> keyed by category.slug + '' (all-bucket)
 */
/**
 * Derives, per direction code, the category options for that direction.
 * Each option has value = category.slug and label = category.name.
 * null-type categories (no direction assigned) are excluded.
 *
 * Also emits an all-bucket under the '' key containing all non-null categories.
 *
 * @param categories - Full taxonomy from getCategories()
 * @returns Record<string, FilterOption[]> keyed by direction code + '' (all-bucket)
 */
export function buildDirectionCategoryMap(
  categories: CategoryWithSubCategories[],
): Record<string, FilterOption[]> {
  if (categories.length === 0) return {}

  const perDirection = new Map<string, FilterOption[]>()
  const allOptions: FilterOption[] = []

  for (const cat of categories) {
    if (cat.type === null) continue
    const option: FilterOption = { value: cat.slug, label: cat.name }
    if (!perDirection.has(cat.type)) perDirection.set(cat.type, [])
    perDirection.get(cat.type)!.push(option)
    allOptions.push(option)
  }

  const result: Record<string, FilterOption[]> = {}
  for (const [direction, opts] of perDirection.entries()) {
    result[direction] = opts
  }
  if (allOptions.length > 0) result[''] = allOptions

  return result
}

export function buildCategorySubcategoryMap(
  categories: CategoryWithSubCategories[],
): Record<string, FilterOption[]> {
  if (categories.length === 0) return {}

  const result: Record<string, FilterOption[]> = {}
  const allOptions: FilterOption[] = []

  for (const cat of categories) {
    // Skip unassigned (null) direction — 'system' was removed from the type union in Plan 03
    if (cat.type === null) continue

    const options: FilterOption[] = cat.subCategories.map((sub) => ({
      value: String(sub.id),
      label: sub.customName ?? sub.name,
    }))

    result[cat.slug] = options
    allOptions.push(...options)
  }

  if (allOptions.length > 0) {
    result[''] = allOptions
  }

  return result
}
