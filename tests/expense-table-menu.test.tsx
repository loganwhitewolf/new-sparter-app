import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// ExpenseTable uses useToolbarSort -> useTableUrl -> next/navigation hooks.
// Pattern matches tests/data-table-toolbar.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/expenses',
}))

// Radix portals omit menu content from SSR; render a flat stub for static markup assertions.
// Pattern matches tests/import-table-actions.test.tsx.
vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react')

  const DropdownMenu = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-slot': 'dropdown-menu' }, children)

  const DropdownMenuTrigger = ({
    children,
    asChild,
  }: {
    children?: ReactNode
    asChild?: boolean
  }) => (asChild ? children : React.createElement('button', { type: 'button' }, children))

  const DropdownMenuContent = ({
    children,
    className,
  }: {
    children?: ReactNode
    className?: string
  }) =>
    React.createElement(
      'div',
      { 'data-slot': 'dropdown-menu-content', className },
      children,
    )

  const DropdownMenuItem = ({
    children,
    asChild,
    onSelect,
    className,
    disabled,
  }: {
    children?: ReactNode
    asChild?: boolean
    onSelect?: () => void
    className?: string
    disabled?: boolean
  }) =>
    asChild
      ? children
      : React.createElement(
          'button',
          { type: 'button', onClick: onSelect, className, disabled },
          children,
        )

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  }
})

const { ExpenseTable } = await import('../components/expenses/expense-table')
const { expenseDetailHref, expenseGroupDetailHref } = await import('../lib/routes')
import type { ExpenseRow } from '../lib/dal/expenses'

const EXPENSE_ID = 'aabbccdd-0000-4000-8000-aabbccddeeff'

function makeExpense(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: EXPENSE_ID,
    title: 'Spesa Esselunga',
    status: '3',
    notes: null,
    createdAt: new Date('2026-06-01'),
    totalAmount: '-25.50',
    transactionCount: 1,
    subCategoryId: 10,
    subCategoryName: 'Supermercato',
    categoryName: 'Spese',
    categorySlug: 'spese',
    platformName: 'Intesa SP',
    firstTransactionAt: new Date('2026-06-01'),
    lastTransactionAt: new Date('2026-06-01'),
    groupId: null,
    groupTitle: null,
    ...overrides,
  }
}

function render(expenses: ExpenseRow[]) {
  return renderToStaticMarkup(
    createElement(ExpenseTable, {
      expenses,
      route: '/expenses',
      categories: [],
      mostUsed: [],
      filters: {},
    }),
  )
}

describe('ExpenseTable — row menu Dettagli entry (DET-07)', () => {
  it('renders exactly one Dettagli entry linking to /expenses/[id]', () => {
    const html = render([makeExpense()])

    expect(html).toContain(`href="${expenseDetailHref(EXPENSE_ID)}"`)
    const matches = html.match(/Dettagli/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('never renders a Modifica menu entry', () => {
    const html = render([makeExpense()])

    expect(html).not.toContain('Modifica')
  })

  it('keeps Ignora and Elimina menu items intact', () => {
    const html = render([makeExpense({ status: '1' })])

    expect(html).toContain('Ignora')
    expect(html).toContain('Elimina')
  })

  it('keeps the amber "Da categorizzare" affordance for uncategorized expenses', () => {
    const html = render([makeExpense({ status: '1', subCategoryId: null, subCategoryName: null })])

    expect(html).toContain('Da categorizzare')
  })
})

describe('ExpenseTable — grouped row rendering (GRP-03)', () => {
  it('renders an "Unita" badge and a Dettagli link to the group route for a grouped row', () => {
    const html = render([makeExpense({ groupId: 42, groupTitle: 'Netflix condiviso' })])

    expect(html).toContain('Unita')
    expect(html).toContain(`href="${expenseGroupDetailHref(42)}"`)
  })

  it('renders the grouped row checkbox as disabled', () => {
    const html = render([makeExpense({ groupId: 42, groupTitle: 'Netflix condiviso' })])

    const checkboxMatch = html.match(/<input type="checkbox"[^>]*aria-label="Seleziona Spesa Esselunga"[^>]*>/)
    expect(checkboxMatch).not.toBeNull()
    expect(checkboxMatch?.[0]).toContain('disabled=""')
  })

  it('renders no Ignora, Elimina, or title-rename control for a grouped row', () => {
    const html = render([makeExpense({ groupId: 42, groupTitle: 'Netflix condiviso' })])

    // "Elimina" alone also appears in the (always-rendered, count=0) BulkActionBar and
    // BulkDeleteExpensesDialog markup, so assert against the per-row controls specifically.
    expect(html).not.toContain('Ignora')
    expect(html).not.toContain('Elimina spesa')
    expect(html).not.toContain('aria-label="Rinomina spesa"')
  })
})
