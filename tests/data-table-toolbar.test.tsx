/**
 * DataTableToolbar — render tests (Wave 2, 40-02; cascade extension lcp-01 Task 2)
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
 *  - Cascade: dependentOptions prop accepted; child chip rendered from toChip; parent+child count as 2 active filters
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

// ---- Mock cascade TableConfig fixture (parent type → child nature) --------
const cascadeConfig: TableConfig = {
  id: 'transactions',
  search: null,
  filters: [
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'in', label: 'Entrate' },
        { value: 'out', label: 'Uscite' },
      ],
      toChip: (v) => `Tipo: ${v}`,
    },
    {
      key: 'nature',
      label: 'Natura',
      type: 'select',
      dependsOn: 'type',
      options: [],
      toChip: (v) => `Natura: ${v}`,
    },
  ],
  sortable: [],
  defaultSort: { key: 'createdAt', dir: 'desc' },
}

const cascadeDependentOptions = {
  nature: {
    '': [
      { value: 'essential', label: 'Essenziale' },
      { value: 'income', label: 'Entrate ricorrenti' },
      { value: 'unclassified', label: 'Non classificato' },
    ],
    in: [
      { value: 'income', label: 'Entrate ricorrenti' },
      { value: 'unclassified', label: 'Non classificato' },
    ],
    out: [
      { value: 'essential', label: 'Essenziale' },
      { value: 'unclassified', label: 'Non classificato' },
    ],
  },
}

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

// ---- Mock tag-filter TableConfig fixture (label-bearing chip, 71-01) ----
// A select filter whose toChip renders the resolved option label (the tag NAME)
// when present, falling back to the raw URL value (the id) otherwise.
const tagConfig: TableConfig = {
  id: 'transactions',
  search: null,
  filters: [
    {
      key: 'tag',
      label: 'Tag',
      type: 'select',
      options: [],
      toChip: (v, label) => `Tag: ${label ?? v}`,
    },
  ],
  sortable: [],
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

// ─── Cascade (dependentOptions) tests ─────────────────────────────────────────

describe('DataTableToolbar cascade (lcp-01 Task 2)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams()
    mockReplace.mockClear()
  })

  it('accepts dependentOptions prop without error when parent param is absent', () => {
    // No type param in URL — child nature should use all-bucket ''
    const html = renderToStaticMarkup(
      <DataTableToolbar
        config={cascadeConfig}
        route="/transactions"
        dependentOptions={cascadeDependentOptions}
      />,
    )
    // Toolbar renders without crashing
    expect(html).toBeTruthy()
    // No filter count badge since no active params
    expect(html).not.toMatch(/Filtri \(\d+\)/)
  })

  it('renders chip for active child (nature) param using field.toChip', () => {
    // Child filter active: nature=income
    mockSearchParams = new URLSearchParams('nature=income')

    const html = renderToStaticMarkup(
      <DataTableToolbar
        config={cascadeConfig}
        route="/transactions"
        dependentOptions={cascadeDependentOptions}
      />,
    )
    // Chip should be derived from nature field's toChip
    expect(html).toContain('Natura: income')
    expect(html).toContain('Filtri (1)')
  })

  it('counts parent and child as separate active filter items', () => {
    // Both type and nature active
    mockSearchParams = new URLSearchParams('type=in&nature=income')

    const html = renderToStaticMarkup(
      <DataTableToolbar
        config={cascadeConfig}
        route="/transactions"
        dependentOptions={cascadeDependentOptions}
      />,
    )
    expect(html).toContain('Filtri (2)')
    expect(html).toContain('Tipo: in')
    expect(html).toContain('Natura: income')
  })
})

// ─── Tag filter chip label resolution (71-01) ────────────────────────────────

describe('DataTableToolbar tag chip label resolution (71-01)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams()
    mockReplace.mockClear()
  })

  it('renders the tag NAME (not the id) in the chip via the toChip label argument', () => {
    // Value is the id (String(tag.id)); the chip must show the injected label.
    mockSearchParams = new URLSearchParams('tag=5')

    const html = renderToStaticMarkup(
      <DataTableToolbar
        config={tagConfig}
        route="/transactions"
        filterOptions={{ tag: [{ value: '5', label: 'Vacanze' }] }}
      />,
    )
    expect(html).toContain('Tag: Vacanze')
    // The bare id must not surface as the chip label
    expect(html).not.toContain('Tag: 5')
  })

  it('renders the archived-marked label for an archived tag option', () => {
    mockSearchParams = new URLSearchParams('tag=9')

    const html = renderToStaticMarkup(
      <DataTableToolbar
        config={tagConfig}
        route="/transactions"
        filterOptions={{ tag: [{ value: '9', label: 'Ferie (archiviato)' }] }}
      />,
    )
    expect(html).toContain('Tag: Ferie (archiviato)')
  })

  it('regression: platform chip still renders the slug when its toChip ignores the 2nd arg', () => {
    // The existing platform filter's toChip reads only its first argument, so
    // passing a resolved label as the 2nd argument must not change its chip.
    mockSearchParams = new URLSearchParams('platform=revolut')

    const html = renderToStaticMarkup(
      <DataTableToolbar
        config={mockConfig}
        route="/transactions"
        filterOptions={{ platform: [{ value: 'revolut', label: 'Revolut' }] }}
      />,
    )
    expect(html).toContain('Piattaforma: revolut')
    expect(html).not.toContain('Piattaforma: Revolut')
  })
})
