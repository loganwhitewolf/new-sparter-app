import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

describe('R-UP-09: CategoryCombobox cleanup', () => {
  it('category-combobox.tsx no longer exists', () => {
    expect(
      existsSync('/Users/andreabernardini/ai-projects/new-sparter-app/components/expenses/category-combobox.tsx'),
    ).toBe(false)
  })

  it('no live import of the expenses CategoryCombobox remains in source files', () => {
    // The deleted file was components/expenses/category-combobox.tsx.
    // We search for imports that reference that specific module path or its named export.
    // We deliberately exclude matches for "subcategory-combobox" (the onboarding component,
    // which is a different module that still exists and is actively imported).
    const result = execSync(
      "grep -rn \"from.*expenses/category-combobox\\|CategoryCombobox\" --include='*.tsx' --include='*.ts' " +
        "/Users/andreabernardini/ai-projects/new-sparter-app/components " +
        "/Users/andreabernardini/ai-projects/new-sparter-app/app " +
        "/Users/andreabernardini/ai-projects/new-sparter-app/lib " +
        "2>/dev/null || true",
      { encoding: 'utf8' },
    )
    // The only valid match would be an import of `CategoryCombobox` (without "Sub" prefix)
    // or a path containing "expenses/category-combobox".
    expect(result.trim()).toBe('')
  })
})
