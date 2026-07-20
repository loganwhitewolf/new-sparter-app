import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// TransactionTable uses useToolbarSort -> useTableUrl -> next/navigation hooks.
// Pattern matches tests/data-table-toolbar.test.tsx.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transactions',
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
const { transactionDetailHref, importFileDetailHref } = await import('../lib/routes')
import type { TransactionListRow } from '../lib/dal/transactions'

const TRANSACTION_ID = 'aabbccdd-0000-4000-8000-aabbccddeeff'

function makeTransaction(overrides: Partial<TransactionListRow> = {}): TransactionListRow {
  return {
    id: TRANSACTION_ID,
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

describe('TransactionTable — row menu Dettagli entry (DET-07)', () => {
  it('renders a Dettagli entry linking to /transactions/[id] as a real link', () => {
    const html = render([makeTransaction()])

    expect(html).toContain(`href="${transactionDetailHref(TRANSACTION_ID)}"`)
    expect(html).toContain('Dettagli')
  })

  it('renders Dettagli for an uncategorized transaction alongside Cerca su Google', () => {
    const html = render([makeTransaction({ expenseId: null })])

    expect(html).toContain('Dettagli')
    expect(html).toContain('Cerca su Google')
  })

  it('renders Dettagli for a categorized transaction alongside Ricategorizza', () => {
    const html = render([
      makeTransaction({
        expenseId: 'expense-1',
        expenseStatus: '3',
        expenseTitle: 'Spesa Esselunga',
        expenseCategoryName: 'Spese',
        expenseSubCategoryName: 'Supermercato',
      }),
    ])

    expect(html).toContain('Dettagli')
    expect(html).toContain('Ricategorizza')
  })

  it('does not remove the Elimina menu item', () => {
    const html = render([makeTransaction()])

    expect(html).toContain('Elimina')
  })
})

describe('TransactionTable — group title precedence (GRP-08)', () => {
  it('renders the group title ahead of the expense title when the linked expense is grouped', () => {
    const html = render([
      makeTransaction({
        expenseId: 'expense-1',
        expenseTitle: 'Cherasco 57 SRL',
        groupId: 1,
        groupTitle: 'Cherasco',
      }),
    ])

    expect(html).toContain('Cherasco')
    expect(html).not.toContain('Cherasco 57 SRL')
  })

  it('still shows customTitle over both groupTitle and expenseTitle when set', () => {
    const html = render([
      makeTransaction({
        customTitle: 'Rinominata da me',
        expenseId: 'expense-1',
        expenseTitle: 'Cherasco 57 SRL',
        groupId: 1,
        groupTitle: 'Cherasco',
      }),
    ])

    expect(html).toContain('Rinominata da me')
    expect(html).not.toContain('Cherasco')
  })
})

describe('TransactionTable — file column link (D-05/D-16 repoint)', () => {
  it('links the file name to importFileDetailHref(transaction.fileId) instead of the legacy ?fileId= filter', () => {
    const html = render([
      makeTransaction({
        fileId: 'file-1',
        fileName: 'estratto.csv',
        platformName: 'Fineco',
      }),
    ])

    expect(html).toContain(`href="${importFileDetailHref('file-1')}"`)
    expect(html).not.toContain('?fileId=')
  })
})
