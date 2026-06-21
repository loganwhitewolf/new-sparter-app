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

const sampleCategories = [
  {
    id: 1,
    name: 'Spese',
    slug: 'spese',
    type: 'out' as const,
    userId: null,
    isOwned: false,
    subCategories: [
      {
        id: 42,
        name: 'Streaming',
        slug: 'streaming',
        originalName: 'Streaming',
        userId: null,
        isOwned: false,
        hasOverride: false,
        customName: null,
        effectiveNature: null,
      },
    ],
  },
]

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

})
