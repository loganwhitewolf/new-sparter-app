import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type {
  CategoryDetailSubcategory,
  CategoryDetailTopTransaction,
  CategoryDetailTrendPoint,
} from '@/lib/dal/dashboard'
import { CategoryDetailEmptyState } from '@/components/dashboard/category-detail-empty-state'
import { CategoryDetailSkeleton } from '@/components/dashboard/category-detail-skeleton'
import { CategoryDetailSummary } from '@/components/dashboard/category-detail-summary'
import { CategoryDetailTrendChart } from '@/components/dashboard/category-detail-trend-chart'
import { CategorySubcategoryBreakdown } from '@/components/dashboard/category-subcategory-breakdown'
import { CategoryTopTransactions } from '@/components/dashboard/category-top-transactions'

const trend: CategoryDetailTrendPoint[] = [
  { month: '2026-01', label: 'Gen', amount: '120.50', count: 2 },
  { month: '2026-02', label: 'Feb', amount: '80.00', count: 1 },
  { month: '2026-03', label: 'Mar', amount: '0.00', count: 0 },
]

const subcategories: CategoryDetailSubcategory[] = [
  { id: 1, name: 'Supermercato', slug: 'supermercato', count: 3, amount: '150.00', percentage: 75 },
  { id: 2, name: 'Mercato', slug: 'mercato', count: 1, amount: '50.00', percentage: 25 },
]

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
  test('renders visible summary fields with formatted values', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailSummary summary={{ total: '200.50', count: 4, average: '50.125' }} type="out" />
    )

    expect(html).toContain('Riepilogo categoria')
    expect(html).toContain('Totale categoria')
    expect(html).toContain('Movimenti')
    expect(html).toContain('Media movimento')
    expect(html).toContain('200,50')
    expect(html).toContain('4 movimenti')
  })

  test('renders zero summary values without throwing', () => {
    const html = renderToStaticMarkup(
      <CategoryDetailSummary summary={{ total: '0.00', count: 0, average: '0.00' }} />
    )

    expect(html).toContain('0 movimenti')
    expect(html).toContain('0,00')
  })

  test('renders a non-empty monthly trend and its accessible detail list', () => {
    const html = renderToStaticMarkup(<CategoryDetailTrendChart data={trend} type="out" />)

    expect(html).toContain('aria-label="Andamento mensile categoria"')
    expect(html).toContain('<polyline')
    expect(html).toContain('Dettaglio andamento mensile')
    expect(html).toContain('Gen')
    expect(html).toContain('120,50')
  })

  test('renders an explicit trend empty state for empty and all-zero buckets', () => {
    const emptyHtml = renderToStaticMarkup(<CategoryDetailTrendChart data={[]} />)
    const zeroHtml = renderToStaticMarkup(
      <CategoryDetailTrendChart
        data={[
          { month: '2026-01', label: 'Gen', amount: '0.00', count: 0 },
          { month: '2026-02', label: 'Feb', amount: 'not-a-number', count: 0 },
        ]}
      />
    )

    expect(emptyHtml).toContain('Nessun andamento disponibile')
    expect(zeroHtml).toContain('Nessun andamento disponibile')
  })

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

  test('renders explicit empty states for top transactions and subcategories', () => {
    const topHtml = renderToStaticMarkup(<CategoryTopTransactions transactions={[]} />)
    const subcategoryHtml = renderToStaticMarkup(<CategorySubcategoryBreakdown subcategories={[]} />)

    expect(topHtml).toContain('Nessun movimento da mostrare')
    expect(subcategoryHtml).toContain('Nessuna sottocategoria nel periodo')
  })

  test('renders subcategory percentages and clamps malformed display values', () => {
    const html = renderToStaticMarkup(
      <CategorySubcategoryBreakdown
        subcategories={[
          ...subcategories,
          { id: 3, name: 'Dato anomalo', slug: 'dato-anomalo', count: Number.NaN, amount: 'oops', percentage: 140 },
        ]}
        type="out"
      />
    )

    expect(html).toContain('Ripartizione sottocategorie')
    expect(html).toContain('Supermercato')
    expect(html).toContain('75% del totale categoria')
    expect(html).toContain('Dato anomalo')
    expect(html).toContain('100% del totale categoria')
    expect(html).toContain('0 movimenti')
  })

  test('renders standalone empty and loading states', () => {
    const emptyHtml = renderToStaticMarkup(<CategoryDetailEmptyState />)
    const skeletonHtml = renderToStaticMarkup(<CategoryDetailSkeleton />)

    expect(emptyHtml).toContain('Nessun dato per questa categoria')
    expect(skeletonHtml).toContain('Caricamento dettaglio categoria')
  })
})
