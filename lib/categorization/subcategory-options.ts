import type { CategoryWithSubCategories } from '@/lib/dal/categories'

export type CategoryOption = {
  value: string
  label: string
  originalName: string
  categoryName: string
  slug: string
  isOwned: boolean
  categoryType: CategoryWithSubCategories['type']
}

/**
 * Flatten a CategoryWithSubCategories tree into selectable options.
 * Pass `allowedCategoryTypes` to restrict to specific category types.
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
      categoryType: cat.type,
    })),
  )
}

/**
 * Filter options by free text across label, originalName, categoryName, and slug.
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
