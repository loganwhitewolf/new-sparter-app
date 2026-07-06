import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
  }
})

const { ImportDisplayNameEdit } = await import(
  '../components/import/import-display-name-edit'
)

const FILE_ID = '11111111-1111-4111-8111-111111111111'

describe('ImportDisplayNameEdit', () => {
  it('renders display name with rename affordance when custom name is set', () => {
    const html = renderToStaticMarkup(
      createElement(ImportDisplayNameEdit, {
        fileId: FILE_ID,
        displayName: 'Gennaio 2026',
        originalName: 'estratto.csv',
      }),
    )

    expect(html).toContain('Gennaio 2026')
    expect(html).toContain('estratto.csv')
    expect(html).toContain('aria-label="Rinomina importazione Gennaio 2026"')
    expect(html).toContain('Clicca per modificare il nome di questa importazione')
  })

  it('falls back to original file name when display name is empty', () => {
    const html = renderToStaticMarkup(
      createElement(ImportDisplayNameEdit, {
        fileId: FILE_ID,
        displayName: null,
        originalName: 'estratto.csv',
      }),
    )

    expect(html).toContain('estratto.csv')
    expect(html).toContain('aria-label="Rinomina importazione estratto.csv"')
  })

  it('renders the title inside a Link when linkHref is provided', () => {
    const html = renderToStaticMarkup(
      createElement(ImportDisplayNameEdit, {
        fileId: FILE_ID,
        displayName: 'Gennaio 2026',
        originalName: 'estratto.csv',
        linkHref: `/import/${FILE_ID}`,
      }),
    )

    expect(html).toContain(`href="/import/${FILE_ID}"`)
    expect(html).toContain('Gennaio 2026')
    // Pencil button remains an independent edit trigger, unaffected by the link.
    expect(html).toContain('aria-label="Rinomina importazione Gennaio 2026"')
  })

  it('renders the title as plain (non-link) text when linkHref is omitted', () => {
    const html = renderToStaticMarkup(
      createElement(ImportDisplayNameEdit, {
        fileId: FILE_ID,
        displayName: 'Gennaio 2026',
        originalName: 'estratto.csv',
      }),
    )

    expect(html).not.toContain('<a ')
    expect(html).toContain('Gennaio 2026')
    expect(html).toContain('aria-label="Rinomina importazione Gennaio 2026"')
  })
})
