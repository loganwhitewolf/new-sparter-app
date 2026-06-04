/**
 * DataTableToolbar — render tests (Wave 2, 40-02)
 *
 * Uses renderToStaticMarkup (project pattern).
 * Interaction tests (debounce, click) are structural: verified via HTML assertions.
 *
 * SSR behavior notes:
 * - Radix Popover/Dialog use portals: PopoverContent and SheetContent do NOT appear
 *   in renderToStaticMarkup output (they render in a portal outside the root element).
 * - Filtri count, chip labels, "Cancella tutto" are tested by passing a mockConfig
 *   and a mock searchParams that returns active values.
 * - We use vi.mock() factory functions (returning vi.fn()) to allow per-test overrides.
 *
 * Behavior covered:
 *  - Search input renders with configured placeholder
 *  - "Filtri (n)" trigger text reflects active filter count
 *  - Chip label rendered for active filter param via field.toChip
 *  - "Cancella tutto" button present when chips are active
 *  - "Ordina" mobile trigger present
 *  - Toolbar renders no search input when config.search is null
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TableConfig } from '@/lib/utils/table-config'

// ---- Mock next/navigation using vi.fn() so we can control per-test --------
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
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
  beforeEach(() => {
    // Reset to empty search params before each test
    mockSearchParams = new URLSearchParams()
    mockReplace.mockClear()
  })

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
    expect(html).toContain('Filtri')
    // Should NOT contain "Filtri (N)" when count is 0
    expect(html).not.toMatch(/Filtri \(\d+\)/)
  })

  it('renders "Filtri (2)" when two filter params are active', () => {
    mockSearchParams = new URLSearchParams('platform=revolut&status=categorized')

    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).toContain('Filtri (2)')
  })

  it('renders SlidersHorizontal icon (toolbar trigger)', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // SlidersHorizontal is an SVG rendered by lucide
    expect(html).toContain('lucide-sliders-horizontal')
  })

  it('renders chip for active filter param via field.toChip()', () => {
    mockSearchParams = new URLSearchParams('platform=revolut')

    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // Chip label derived from field.toChip('revolut')
    expect(html).toContain('Piattaforma: revolut')
  })

  it('renders "Cancella tutto" when chips are active', () => {
    mockSearchParams = new URLSearchParams('platform=revolut')

    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).toContain('Cancella tutto')
  })

  it('does not render "Cancella tutto" when no chips are active', () => {
    // mockSearchParams is empty (reset in beforeEach)
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).not.toContain('Cancella tutto')
  })

  it('renders "Filtri" label (present on both desktop Popover trigger and mobile Sheet trigger)', () => {
    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    // Both desktop and mobile render "Filtri" — appears multiple times
    expect(html).toContain('Filtri')
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

  it('renders chip count badge "Filtri (1)" for single active filter', () => {
    mockSearchParams = new URLSearchParams('status=categorized')

    const html = renderToStaticMarkup(
      <DataTableToolbar config={mockConfig} route="/transactions" />,
    )
    expect(html).toContain('Filtri (1)')
  })
})
