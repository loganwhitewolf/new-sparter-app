import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  formAction: vi.fn(),
  onboardingCategorizeExpense: vi.fn(),
}))

vi.mock('@/lib/actions/onboarding', () => ({
  onboardingCategorizeExpense: mocks.onboardingCategorizeExpense,
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useActionState: () => [{ error: null }, mocks.formAction, false] as const,
  }
})

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-slot': 'popover' }, children),
  PopoverTrigger: ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-slot': 'popover-trigger' }, children),
  PopoverContent: ({ children, className }: { children?: ReactNode; className?: string }) =>
    React.createElement('div', { 'data-slot': 'popover-content', className }, children),
}))

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-slot': 'command' }, children),
  CommandInput: ({ placeholder }: { placeholder?: string }) =>
    React.createElement('input', { placeholder, 'data-slot': 'command-input' }),
  CommandList: ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-slot': 'command-list' }, children),
  CommandEmpty: ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-slot': 'command-empty' }, children),
  CommandGroup: ({ children, heading }: { children?: ReactNode; heading?: string }) =>
    React.createElement('section', { 'aria-label': heading }, children),
  CommandItem: ({
    children,
    value,
  }: {
    children?: ReactNode
    value?: string
    onSelect?: (value: string) => void
  }) => React.createElement('div', { role: 'option', 'data-value': value }, children),
}))

const {
  SubcategoryCombobox,
  buildOnboardingCategorizeFormData,
} = await import('@/app/(app)/onboarding/_components/subcategory-combobox')

const categories = [
  {
    id: 1,
    name: 'Spese',
    slug: 'spese',
    type: 'out' as const,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 10,
        name: 'Alimentari',
        slug: 'alimentari',
        originalName: 'Alimentari',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'essential' as const,
      },
      {
        id: 11,
        name: 'Altro',
        slug: 'altro',
        originalName: 'Altro',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: null,
      },
    ],
  },
  {
    id: 2,
    name: 'Entrate',
    slug: 'entrate',
    type: 'in' as const,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 20,
        name: 'Stipendio',
        slug: 'stipendio',
        originalName: 'Stipendio',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: 'income' as const,
      },
    ],
  },
]

function renderCombobox(amount = '-42.50') {
  return renderToStaticMarkup(
    <SubcategoryCombobox
      expenseId="expense-1"
      expenseTitle="Supermercato"
      expenseAmount={amount}
      categories={categories}
    />,
  )
}

describe('SubcategoryCombobox (R-OB-07)', () => {
  it("R-OB-07 renders the trigger with 'Seleziona categoria...' before selection", () => {
    const html = renderCombobox()

    expect(html).toContain('Seleziona categoria...')
  })

  it('R-OB-07 renders subcategories grouped by category in the command list', () => {
    const html = renderCombobox()

    expect(html).toContain('aria-label="Spese"')
    expect(html).toContain('aria-label="Entrate"')
    expect(html).toContain('Alimentari')
    expect(html).toContain('Stipendio')
  })

  it('R-OB-07 renders the FlowNature Italian label as a badge next to each subcategory', () => {
    const html = renderCombobox()

    expect(html).toContain('Alimentari')
    expect(html).toContain('Essenziale')
    expect(html).toContain('Altro')
    expect(html).toContain('Non classificato')
  })

  it('R-OB-07 builds FormData with the expense id and selected subCategoryId on select', () => {
    const formData = buildOnboardingCategorizeFormData('expense-1', 10)

    expect(formData.get('id')).toBe('expense-1')
    expect(formData.get('subCategoryId')).toBe('10')
  })

  it('uses only design-system color tokens for the amount tint', () => {
    const negativeHtml = renderCombobox('-42.50')
    const positiveHtml = renderCombobox('42.50')

    expect(negativeHtml).toContain('text-destructive')
    expect(positiveHtml).toContain('text-success')
    expect(negativeHtml).not.toMatch(/text-green-|text-red-/)
    expect(positiveHtml).not.toMatch(/text-green-|text-red-/)
  })
})
