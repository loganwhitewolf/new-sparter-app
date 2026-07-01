import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  analyzeImport: vi.fn(),
  push: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('notFound')
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/actions/import', () => ({
  analyzeImportAction: mocks.analyzeImport,
  confirmImportAction: vi.fn(),
}))

const { default: AnalyzePage } = await import('../app/(app)/import/[fileId]/analyze/page')

const FILE_ID = '11111111-1111-4111-8111-111111111111'

function analysisResult(overrides = {}) {
  return {
    fileId: FILE_ID,
    formatVersionId: 1,
    platformName: 'Fineco',
    rowCount: 2,
    duplicateCount: 0,
    warnings: [],
    errors: [],
    sampleRows: [
      {
        rowIndex: 1,
        description: 'Coffee',
        amount: '-2.50',
        occurredAt: '2026-01-01',
        duplicate: false,
        valid: true,
        errors: [],
        warnings: [],
      },
    ],
    ...overrides,
  }
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const element = await AnalyzePage({
    params: Promise.resolve({ fileId: FILE_ID }),
    searchParams: Promise.resolve(searchParams),
  })

  return renderToStaticMarkup(createElement(() => element))
}

describe('AnalyzePage', () => {
  it('redirects to configure when analysis failed because no platform format matched', async () => {
    mocks.analyzeImport.mockResolvedValueOnce({
      error: 'No supported import format matched the uploaded file headers and sample rows.',
      data: analysisResult({
        formatVersionId: null,
        platformName: null,
        errors: ['No supported import format matched the uploaded file headers and sample rows.'],
      }),
    })

    await expect(renderPage()).rejects.toThrow(
      `redirect:/import/${encodeURIComponent(FILE_ID)}/configure`,
    )
  })

  it('shows the preview for a recognized import format', async () => {
    mocks.analyzeImport.mockResolvedValueOnce({
      error: null,
      data: analysisResult(),
    })

    const html = await renderPage()

    expect(html).toContain('Anteprima transazioni')
    expect(html).toContain('Conferma importazione')
    expect(html).toContain('Torna alle importazioni')
    expect(html).not.toContain('Formato non riconosciuto')
  })
})
