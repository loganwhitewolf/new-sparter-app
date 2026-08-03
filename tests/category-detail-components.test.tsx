import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { CategoryDetailTopTransaction } from '@/lib/dal/dashboard'
import { CategoryDetailEmptyState } from '@/components/dashboard/category-detail-empty-state'
import { CategoryDetailSkeleton } from '@/components/dashboard/category-detail-skeleton'
import { CategoryTopTransactions } from '@/components/dashboard/category-top-transactions'

// CategorySubcategoryBreakdown's own coverage moved to tests/category-subcategory-breakdown.test.tsx
// (Plan 84-02 Task 2) — its props were rewritten (contributions/year replace subcategories/deviations,
// D-16) and this file's prior assertions tested the retired DeviationBadge-based shape.
//
// CategoryDetailSummary and CategoryDetailTrendChart were retired outright in Plan 84-04 (D-07/D-08):
// the summary is subsumed by the detail table's sticky summary column, and the trend chart is
// replaced by the difference chart consuming the same window series the table renders.

const transactions: CategoryDetailTopTransaction[] = [
  {
    id: 'tx-1',
    title: 'Spesa settimanale',
    description: 'SUPERMERCATO CENTRALE',
    date: '2026-02-12',
    amount: '95.20',
  },
  {
    id: 'tx-2',
    title: '',
    description: 'BANCO ALIMENTARE',
    date: '2026-02-10',
    amount: '64.10',
  },
]

describe('category detail presentation components', () => {
  test('renders top transactions with title preference and description fallback', () => {
    const html = renderToStaticMarkup(<CategoryTopTransactions transactions={transactions} />)

    expect(html).toContain('Top 5 movimenti categoria')
    expect(html).toContain('Spesa settimanale')
    expect(html).toContain('SUPERMERCATO CENTRALE')
    expect(html).toContain('BANCO ALIMENTARE')
    expect(html).toContain('95,20')
  })

  test('limits top transactions to five rows', () => {
    const manyTransactions = Array.from({ length: 6 }, (_, index): CategoryDetailTopTransaction => ({
      id: `tx-${index + 1}`,
      title: `Movimento ${index + 1}`,
      description: `Descrizione ${index + 1}`,
      date: '2026-02-12',
      amount: String(100 - index),
    }))

    const html = renderToStaticMarkup(<CategoryTopTransactions transactions={manyTransactions} />)

    expect(html).toContain('Movimento 5')
    expect(html).not.toContain('Movimento 6')
  })

  test('renders an explicit empty state for top transactions', () => {
    const topHtml = renderToStaticMarkup(<CategoryTopTransactions transactions={[]} />)
    expect(topHtml).toContain('Nessun movimento da mostrare')
  })

  test('renders standalone empty and loading states', () => {
    const emptyHtml = renderToStaticMarkup(<CategoryDetailEmptyState />)
    const skeletonHtml = renderToStaticMarkup(<CategoryDetailSkeleton />)

    expect(emptyHtml).toContain('Nessun dato per questa categoria')
    expect(skeletonHtml).toContain('Caricamento dettaglio categoria')
  })
})
