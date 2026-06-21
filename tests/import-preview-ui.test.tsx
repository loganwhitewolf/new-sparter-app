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

vi.mock('@/lib/actions/import', () => ({
  confirmImportAction: mocks.confirmImport,
}))

const { ImportPreview } = await import('../components/import/import-preview')

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

})
