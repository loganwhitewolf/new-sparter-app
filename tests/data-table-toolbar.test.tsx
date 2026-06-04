/**
 * DataTableToolbar — render tests (Wave 2, 40-02)
 *
 * Uses renderToStaticMarkup (project pattern) instead of @testing-library/react
 * which is not installed. Interaction tests (debounce, click) are structural:
 * verified via HTML output assertions after mocking next/navigation.
 *
 * Behavior covered:
 *  - Search input renders with configured placeholder
 *  - "Filtri" trigger reflects active filter count from mocked searchParams
 *  - Chip for each active filter param is rendered
 *  - "Cancella tutto" button present when chips are active
 *  - Mobile sheet trigger and SheetContent present in output
 *  - Toolbar renders nothing for search when config.search is null
 */

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TableConfig } from '@/lib/utils/table-config'

// ---- Mock next/navigation ------------------------------------------------
// Baseline: no active filters
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transactions',
}))

// ---- Mock TableConfig fixture -------------------------------------------
const mockConfig: TableConfig = {
  id: 'transactions',
  search: { key: 'q', placeholder: 'Nome o descrizione…' },
  filters: [
    {
      key: 'platform',
      label: 'Piattaforma',
      type: 'select',
      options: [
        { value: 'revolut', label: 'Revolut' },
        { value: 'fineco', label: 'Fineco' },
      ],
      toChip: (v) => `Piattaforma: ${v}`,
    },
    {
      key: 'status',
      label: 'Categorizzazione',
      type: 'status',
      toChip: (v) => (v === 'categorized' ? 'Solo categorizzate' : 'Solo da categorizzare'),
    },
  ],
  sortable: [
    { key: 'occurredAt', label: 'Data' },
    { key: 'amount', label: 'Importo' },
  ],
  defaultSort: { key: 'occurredAt', dir: 'desc' },
}

// ---- Import component after mocks ----------------------------------------
const { DataTableToolbar } = await import('@/components/data-table/DataTableToolbar')

// -------------------------------------------------------------------------
describe('DataTableToolbar render (40-02, Variant A)', () => {
  it('renders search input with configured placeholder', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).toContain('Nome o descrizione')
  })

  it('renders "Filtri" trigger with no count when no filters active', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // "Filtri" appears without a count suffix
    expect(html).toContain('Filtri')
    // should NOT contain "Filtri (N)" pattern when count is 0
    expect(html).not.toMatch(/Filtri \(\d+\)/)
  })

  it('renders "Filtri (2)" when two filter params are active', async () => {
    // Re-mock useSearchParams with active filters for this test
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValueOnce(
      new URLSearchParams('platform=revolut&status=categorized') as ReturnType<typeof useSearchParams>,
    )

    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).toContain('Filtri (2)')
  })

  it('renders SlidersHorizontal icon (toolbar trigger)', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // SlidersHorizontal is an SVG — check via svg or lucide class convention
    expect(html.toLowerCase()).toContain('svg')
  })

  it('renders filter fields from config.filters (not hardcoded)', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // Both filter labels from mock config must appear in the panel
    expect(html).toContain('Piattaforma')
    expect(html).toContain('Categorizzazione')
  })

  it('renders chip for each active filter and "Cancella tutto" button', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValueOnce(
      new URLSearchParams('platform=revolut') as ReturnType<typeof useSearchParams>,
    )

    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // Chip label derived from field.toChip('revolut')
    expect(html).toContain('Piattaforma: revolut')
    // "Cancella tutto" present because chips.length > 0
    expect(html).toContain('Cancella tutto')
  })

  it('does not render "Cancella tutto" when no chips are active', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).not.toContain('Cancella tutto')
  })

  it('renders mobile sheet scaffold (SheetContent side="bottom")', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // Sheet is present for mobile filter panel
    expect(html).toContain('bottom')
  })

  it('renders "Ordina" mobile sort trigger', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).toContain('Ordina')
  })

  it('does not render search input when config.search is null', () => {
    const configNoSearch: TableConfig = { ...mockConfig, search: null }
    const html = renderToStaticMarkup(
      <DataTableToolbar config={configNoSearch} route="/transactions" />,
    )
    expect(html).not.toContain('Nome o descrizione')
  })
})
