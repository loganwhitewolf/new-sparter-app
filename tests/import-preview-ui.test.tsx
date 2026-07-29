import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  confirmImport: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children?: React.ReactNode
    [key: string]: unknown
  }) => createElement('a', { href, ...rest }, children),
}))

vi.mock('@/lib/actions/import', () => ({
  confirmImportAction: mocks.confirmImport,
}))

const { ImportPreview, appendImportModeFields } = await import('../components/import/import-preview')

const baseResult = {
  fileId: '11111111-1111-4111-8111-111111111111',
  formatVersionId: null,
  platformName: null,
  rowCount: 12,
  duplicateCount: 0,
  createdCount: 0,
  skippedCount: 0,
  warnings: [],
  errors: [],
  lastImportedDate: null as string | null,
  filePeriodStart: null as string | null,
  filePeriodEnd: null as string | null,
  sampleRows: [],
}

describe('ImportPreview UI', () => {
  it('does not render a destructive error box or confirm action when confirmation is disabled upstream', () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        result: baseResult,
        confirmDisabledReason: "Configura un formato privato prima di confermare l'importazione.",
      }),
    )

    expect(html).toContain('Righe trovate')
    expect(html).toContain('Piattaforma')
    expect(html).not.toContain('Configura un formato privato prima di confermare')
    expect(html).not.toContain('Conferma importazione')
    expect(html).not.toContain('data-variant="destructive"')
  })

  it('keeps real analysis errors visible as destructive feedback', () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        result: {
          ...baseResult,
          errors: ['Impossibile leggere il file caricato. Riprova.'],
        },
      }),
    )

    expect(html).toContain('Impossibile leggere il file caricato. Riprova.')
    expect(html).toContain('data-slot="alert"')
    expect(html).not.toContain('Conferma importazione')
  })

  it('SUMUI-01: renders at most 10 sample rows even when result has 25', () => {
    const twentyFiveRows = Array.from({ length: 25 }, (_, i) => ({
      rowIndex: i,
      description: `DESC-${i}`,
      amount: '10.00',
      occurredAt: '2024-01-01',
      transactionHash: null,
      duplicate: false,
      valid: true,
      errors: [],
      warnings: [],
      rawRow: {},
    }))

    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        result: {
          ...baseResult,
          sampleRows: twentyFiveRows,
        },
      }),
    )

    // Each row renders the description in a table cell; count occurrences
    const descMatches = (html.match(/DESC-\d+/g) ?? []).length
    expect(descMatches).toBe(10)
  })

  it('renders mode controls in order from-last → all → range next to title (D-07)', () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, { result: baseResult }),
    )

    expect(html).toContain('Analisi file')
    expect(html).toMatch(/Dall(?:'|&#x27;)ultima/)
    expect(html).toContain('Tutte')
    expect(html).toContain('Intervallo')

    const fromLast = html.indexOf('data-import-mode="from-last"')
    const all = html.indexOf('data-import-mode="all"')
    const range = html.indexOf('data-import-mode="range"')
    expect(fromLast).toBeGreaterThan(-1)
    expect(all).toBeGreaterThan(fromLast)
    expect(range).toBeGreaterThan(all)
  })

  it('renders Transazioni nel periodo card (D-06)', () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        result: {
          ...baseResult,
          lastImportedDate: null,
          filePeriodStart: '2026-07-10',
          filePeriodEnd: '2026-07-20',
          sampleRows: [
            {
              rowIndex: 1,
              description: 'A',
              amount: '-1.00',
              occurredAt: '2026-07-10T00:00:00.000Z',
              duplicate: false,
              valid: true,
              errors: [],
              warnings: [],
            },
            {
              rowIndex: 2,
              description: 'B',
              amount: '-2.00',
              occurredAt: '2026-07-20T00:00:00.000Z',
              duplicate: false,
              valid: true,
              errors: [],
              warnings: [],
            },
          ],
        },
      }),
    )

    expect(html).toContain('Transazioni nel periodo')
    expect(html).toContain('10/07/2026 – 20/07/2026')
  })

  it('appendImportModeFields sends importMode and range bounds for range mode', () => {
    const fd = new FormData()
    appendImportModeFields(fd, {
      importMode: 'from-last',
    })
    expect(fd.get('importMode')).toBe('from-last')
    expect(fd.get('rangeStart')).toBeNull()

    const rangeFd = new FormData()
    appendImportModeFields(rangeFd, {
      importMode: 'range',
      rangeStart: '2026-07-15',
      rangeEnd: '2026-07-20',
    })
    expect(rangeFd.get('importMode')).toBe('range')
    expect(rangeFd.get('rangeStart')).toBe('2026-07-15')
    expect(rangeFd.get('rangeEnd')).toBe('2026-07-20')
  })
})
