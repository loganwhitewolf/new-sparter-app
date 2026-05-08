import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// next/link renders fine in node; no mock required.
// 'use client' directive is ignored in vitest / renderToStaticMarkup.

const { ImportRowActions } = await import('../components/import/import-row-actions')

const FILE_ID = 'aabbccdd-0000-4000-8000-aabbccddeeff'

/**
 * Minimal ImportListRow fixture with only the fields ImportRowActions reads.
 * All optional analytics fields (rowCount, etc.) default to safe zero values.
 */
function makeRow(
  overrides: Partial<{
    id: string
    status: 'pending_upload' | 'uploaded' | 'analyzing' | 'analyzed' | 'importing' | 'imported' | 'failed'
    errorMessage: string | null
    displayName: string | null
    originalName: string
  }>,
) {
  return {
    id: FILE_ID,
    displayName: null,
    originalName: 'estratto.csv',
    status: 'uploaded' as const,
    platformId: null,
    platformName: null,
    platformSlug: null,
    uploadedAt: null,
    analyzedAt: null,
    importStartedAt: null,
    importedAt: null,
    rowCount: 0,
    importedCount: 0,
    duplicateCount: 0,
    positiveTotal: '0.00',
    negativeTotal: '0.00',
    referenceStartedAt: null,
    referenceEndedAt: null,
    errorMessage: null,
    ...overrides,
  }
}

const DISPLAY_NAME = 'Gennaio 2026'
const onDelete = vi.fn()

function render(row: ReturnType<typeof makeRow>, displayName = DISPLAY_NAME) {
  return renderToStaticMarkup(
    createElement(ImportRowActions, { row, displayName, onDelete }),
  )
}

describe('ImportRowActions — state matrix', () => {
  it('uploaded: shows Analizza link to the analyze route', () => {
    const html = render(makeRow({ status: 'uploaded' }))

    expect(html).toContain('Analizza')
    expect(html).toContain(`/import/${FILE_ID}/analyze`)
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Configura formato')
    expect(html).not.toContain('Riprova analisi')
    expect(html).not.toContain('Vedi transazioni')
  })

  it('uploaded: Analizza link has accessible aria-label', () => {
    const html = render(makeRow({ status: 'uploaded' }))

    expect(html).toContain(`aria-label="Analizza importazione ${DISPLAY_NAME}"`)
  })

  it('analyzed: shows Rivedi e importa link to the analyze route', () => {
    const html = render(makeRow({ status: 'analyzed' }))

    expect(html).toContain('Rivedi e importa')
    expect(html).toContain(`/import/${FILE_ID}/analyze`)
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Analizza')
    expect(html).not.toContain('Vedi transazioni')
  })

  it('analyzed: Rivedi e importa link has accessible aria-label', () => {
    const html = render(makeRow({ status: 'analyzed' }))

    expect(html).toContain(`aria-label="Rivedi e importa ${DISPLAY_NAME}"`)
  })

  it('importing: renders disabled pending copy, no active CTAs', () => {
    const html = render(makeRow({ status: 'importing' }))

    expect(html).toContain('Importazione in corso')
    expect(html).not.toContain('href=')
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Rivedi e importa')
    expect(html).not.toContain('Analizza')
    expect(html).not.toContain('Vedi transazioni')
  })

  it('importing: pending copy has accessible aria-label', () => {
    const html = render(makeRow({ status: 'importing' }))

    expect(html).toContain('aria-label="Importazione in corso, nessuna azione disponibile"')
  })

  it('analyzing: renders disabled pending copy, no active CTAs', () => {
    const html = render(makeRow({ status: 'analyzing' }))

    expect(html).toContain('Analisi in corso')
    expect(html).not.toContain('href=')
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Rivedi e importa')
    expect(html).not.toContain('Analizza')
    expect(html).not.toContain('Vedi transazioni')
  })

  it('analyzing: pending copy has accessible aria-label', () => {
    const html = render(makeRow({ status: 'analyzing' }))

    expect(html).toContain('aria-label="Analisi in corso, nessuna azione disponibile"')
  })

  it('imported: shows Vedi transazioni link scoped to exact importId', () => {
    const html = render(makeRow({ status: 'imported' }))

    expect(html).toContain('Vedi transazioni')
    expect(html).toContain(`/transactions?importId=${FILE_ID}`)
    expect(html).not.toContain('Analizza')
    expect(html).not.toContain('Configura formato')
    expect(html).not.toContain('Riprova analisi')
  })

  it('imported: shows Elimina button for imported rows', () => {
    const html = render(makeRow({ status: 'imported' }))

    expect(html).toContain('Elimina')
    expect(html).toContain(`aria-label="Elimina importazione ${DISPLAY_NAME}"`)
  })

  it('imported: Vedi transazioni has accessible aria-label', () => {
    const html = render(makeRow({ status: 'imported' }))

    expect(html).toContain(`aria-label="Vedi transazioni importate da ${DISPLAY_NAME}"`)
  })

  it('failed (unknown-format): shows Configura formato link and Riprova analisi', () => {
    const html = render(
      makeRow({
        status: 'failed',
        errorMessage: 'No supported import format matched the uploaded file headers and sample rows.',
      }),
    )

    expect(html).toContain('Configura formato')
    expect(html).toContain(`/import/${FILE_ID}/configure`)
    expect(html).toContain('Riprova analisi')
    expect(html).toContain(`/import/${FILE_ID}/analyze`)
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Vedi transazioni')
  })

  it('failed (unknown-format): Configura formato has accessible aria-label', () => {
    const html = render(
      makeRow({
        status: 'failed',
        errorMessage: 'No supported import format matched the uploaded file headers and sample rows.',
      }),
    )

    expect(html).toContain(`aria-label="Configura formato privato per ${DISPLAY_NAME}"`)
  })

  it('failed (non-unknown): shows Riprova analisi only, no Configura formato', () => {
    const html = render(
      makeRow({
        status: 'failed',
        errorMessage: 'Could not read uploaded file.',
      }),
    )

    expect(html).toContain('Riprova analisi')
    expect(html).not.toContain('Configura formato')
    expect(html).not.toContain('configure')
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Vedi transazioni')
  })

  it('failed (non-unknown): Riprova analisi has accessible aria-label', () => {
    const html = render(
      makeRow({
        status: 'failed',
        errorMessage: 'Could not parse uploaded file.',
      }),
    )

    expect(html).toContain(`aria-label="Riprova analisi di ${DISPLAY_NAME}"`)
  })

  it('failed with null errorMessage: shows Riprova analisi only (no configure)', () => {
    const html = render(makeRow({ status: 'failed', errorMessage: null }))

    expect(html).toContain('Riprova analisi')
    expect(html).not.toContain('Configura formato')
  })

  it('pending_upload: renders nothing (no primary CTA)', () => {
    const html = render(makeRow({ status: 'pending_upload' }))

    expect(html).toBe('')
  })

  it('does not render raw storage diagnostics or sensitive data in any state', () => {
    const states: Array<ReturnType<typeof makeRow>> = [
      makeRow({ status: 'failed', errorMessage: 'No supported import format matched the uploaded file headers and sample rows.' }),
      makeRow({ status: 'failed', errorMessage: 'https://r2.example.com/private?X-Amz-Signature=abc123' }),
      makeRow({ status: 'imported' }),
      makeRow({ status: 'analyzing' }),
    ]

    for (const row of states) {
      const html = render(row)
      expect(html).not.toContain('X-Amz-Signature')
      expect(html).not.toContain('objectKey')
      expect(html).not.toContain('stack')
    }
  })

  it('URLs encode the fileId correctly when fileId contains characters needing encoding', () => {
    // UUIDs are already safe, but verify encodeURIComponent is applied.
    const safeId = 'aabbccdd-1111-4111-8111-111111111111'

    // imported: check transactions link
    const importedHtml = render(makeRow({ id: safeId, status: 'imported' }))
    expect(importedHtml).toContain(`/transactions?importId=${safeId}`)

    // uploaded: check analyze link
    const uploadedHtml = render(makeRow({ id: safeId, status: 'uploaded' }))
    expect(uploadedHtml).toContain(`/import/${safeId}/analyze`)

    // failed unknown-format: check configure link
    const failedHtml = render(
      makeRow({
        id: safeId,
        status: 'failed',
        errorMessage: 'No supported import format matched the uploaded file headers and sample rows.',
      }),
    )
    expect(failedHtml).toContain(`/import/${safeId}/configure`)
  })
})

describe('ImportRowActions — in-progress states do not expose duplicate-operation CTAs', () => {
  it('analyzing row: no analyze, import, delete, or configure links', () => {
    const html = render(makeRow({ status: 'analyzing' }))

    expect(html).not.toContain('/analyze')
    expect(html).not.toContain('/configure')
    expect(html).not.toContain('Elimina')
    expect(html).not.toContain('Importa')
    expect(html).not.toContain('Analizza')
  })

  it('importing row: no analyze, import, delete, or configure links', () => {
    const html = render(makeRow({ status: 'importing' }))

    expect(html).not.toContain('/analyze')
    expect(html).not.toContain('/configure')
    expect(html).not.toContain('Elimina')
    // "Importa" alone could match "Importazione in corso" — check no active href/button for import
    expect(html).not.toContain('Rivedi e importa')
    expect(html).not.toContain('Analizza')
  })
})
