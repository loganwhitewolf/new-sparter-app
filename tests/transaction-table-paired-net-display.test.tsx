import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// TransactionTable uses useToolbarSort -> useTableUrl -> next/navigation hooks.
// Pattern matches tests/transaction-table-menu.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transactions',
}))

// Radix portals omit menu content from SSR; render a flat stub for static markup assertions.
// Pattern matches tests/transaction-table-menu.test.tsx.
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

const ANCHOR_ID = 'aabbccdd-0000-4000-8000-aabbccddeeff'
const COUNTERPART_ID = 'aabbccdd-1111-4000-8000-aabbccddeeff'
const UNPAIRED_ID = 'aabbccdd-2222-4000-8000-aabbccddeeff'

function makeTransaction(overrides: Partial<TransactionListRow> = {}): TransactionListRow {
  return {
    id: UNPAIRED_ID,
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

describe('TransactionTable — anchor row net-primary amount display (D-N2)', () => {
  it('renders both the net figure and the struck-through gross figure for an anchor row', () => {
    const html = render([
      makeTransaction({
        id: ANCHOR_ID,
        amount: '-133.00',
        pairedWithId: COUNTERPART_ID,
        pairedNetAmount: '-33.00',
      }),
    ])

    expect(html).toContain('33,00')
    expect(html).toContain('133,00')
    expect(html).toContain('line-through')
  })

  it('renders no line-through class for an unpaired row (zero visual regression)', () => {
    const html = render([makeTransaction({ pairedWithId: null })])

    expect(html).not.toContain('line-through')
  })
})
