/**
 * Tests for the transactions table footer's net-totals summary (D-01–D-08).
 * Reuses the next/navigation + dropdown-menu mocks and makeTransaction/render helpers
 * established in tests/transaction-table-paired-net-display.test.tsx.
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transactions',
}))

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
  }: {
    children?: ReactNode
    asChild?: boolean
    onSelect?: () => void
    className?: string
  }) =>
    asChild
      ? children
      : React.createElement('button', { type: 'button', onClick: onSelect, className }, children)

  const DropdownMenuSeparator = () =>
    React.createElement('hr', { 'data-slot': 'dropdown-menu-separator' })

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  }
})

const { TransactionTable } = await import('../components/transactions/transaction-table')
import type { TransactionListRow } from '../lib/dal/transactions'

const PAGE_SIZE = 50

function makeTransaction(overrides: Partial<TransactionListRow> = {}): TransactionListRow {
  return {
    id: 'aabbccdd-0000-4000-8000-aabbccddeeff',
    description: 'PAGAMENTO POS ESSELUNGA',
    customTitle: null,
    amount: '-25.50',
    currency: 'EUR',
    occurredAt: new Date('2026-06-01'),
    rowIndex: 0,
    expenseId: null,
    expenseTitle: null,
    expenseTransactionCount: null,
    expenseStatus: null,
    expenseCategoryName: null,
    expenseSubCategoryName: null,
    fileId: null,
    fileName: null,
    importedAt: null,
    platformId: null,
    platformName: null,
    platformSlug: null,
    categoryType: null,
    groupId: null,
    groupTitle: null,
    pairedWithId: null,
    pairedNetAmount: null,
    pairedAmount: null,
    pairedDescription: null,
    pairedOccurredAt: null,
    reimbursementId: null,
    amortizationPlanId: null,
    amortizationPlanStatus: null,
    ...overrides,
  }
}

function makeManyTransactions(count: number, overrides: Partial<TransactionListRow> = {}) {
  return Array.from({ length: count }, (_, i) =>
    makeTransaction({
      id: `aabbccdd-${String(i).padStart(4, '0')}-4000-8000-aabbccddeeff`,
      rowIndex: i,
      ...overrides,
    }),
  )
}

function render(transactions: TransactionListRow[]) {
  return renderToStaticMarkup(
    createElement(TransactionTable, {
      transactions,
      route: '/transactions',
      searchParams: {},
      categories: [],
      mostUsed: [],
      tags: [],
      tagsByTransactionId: {},
    }),
  )
}

describe('TransactionTable footer — net totals summary (D-01–D-08)', () => {
  it('renders the total count plus Entrate/Uscite/Differenza when all rows are loaded', () => {
    const html = render([
      makeTransaction({ id: 'a', amount: '100.00' }),
      makeTransaction({ id: 'b', amount: '-40.00' }),
    ])

    expect(html).not.toContain('Tutte le transazioni disponibili sono caricate.')
    expect(html).toContain('2 transazioni')
    expect(html).toContain('Entrate')
    expect(html).toContain('Uscite')
    expect(html).toContain('Differenza')
    // Reconciling figures: Entrate 100,00 / Uscite 40,00 / Differenza +60,00.
    // Entrate/Uscite render absolute, Differenza renders signed — assert the sign
    // explicitly so a regression that drops it cannot pass on a bare '60,00' substring.
    expect(html).toContain('100,00')
    expect(html).toContain('40,00')
    expect(html).toMatch(/\+60,00/)
  })

  it('single-currency (all-EUR) footer renders no per-bucket currency label', () => {
    const html = render([
      makeTransaction({ id: 'a', amount: '10.00', currency: 'EUR' }),
    ])
    // No standalone currency code label should appear before Entrate in the single-bucket case.
    expect(html).not.toMatch(/>EUR</)
  })

  it('shows the "Carica altre 50 transazioni" button and no totals when hasMore is true', () => {
    const html = render(makeManyTransactions(PAGE_SIZE))

    expect(html).toContain('Carica altre 50 transazioni')
    expect(html).not.toContain('Entrate')
    expect(html).not.toContain('Uscite')
    expect(html).not.toContain('Differenza')
  })

  it('renders neither the button nor the summary for an empty transactions array', () => {
    const html = render([])

    expect(html).not.toContain('Carica altre 50 transazioni')
    expect(html).not.toContain('Entrate')
    expect(html).not.toContain('Uscite')
  })

  it('renders one Entrate/Uscite/Differenza line per currency, labeled, alongside a single total count (D-08)', () => {
    const html = render([
      makeTransaction({ id: 'a', amount: '100.00', currency: 'EUR' }),
      makeTransaction({ id: 'b', amount: '-25.00', currency: 'EUR' }),
      makeTransaction({ id: 'c', amount: '50.00', currency: 'USD' }),
    ])

    expect(html).toContain('3 transazioni')
    expect(html).toMatch(/>EUR</)
    expect(html).toMatch(/>USD</)
    // Only one total-count line should appear (D-08).
    expect(html.match(/3 transazioni/g)?.length).toBe(1)
  })
})
