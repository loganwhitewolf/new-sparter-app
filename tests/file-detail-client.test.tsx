import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const FILE_ID = 'file-1'

function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    id: FILE_ID,
    userId: 'user-1',
    importFormatVersionId: 1,
    originalName: 'estratto.csv',
    displayName: 'Estratto marzo',
    contentHash: 'hash',
    objectKey: 'key',
    mimeType: 'text/csv',
    sizeBytes: 1024,
    status: 'imported' as const,
    uploadedAt: new Date('2026-03-01'),
    analyzedAt: new Date('2026-03-01'),
    importStartedAt: new Date('2026-03-01'),
    importedAt: new Date('2026-03-02'),
    rowCount: 12,
    importedCount: 10,
    duplicateCount: 2,
    positiveTotal: '500.00',
    negativeTotal: '-320.00',
    referenceStartedAt: new Date('2026-03-01'),
    referenceEndedAt: new Date('2026-03-31'),
    errorMessage: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-02'),
    platformName: 'Intesa SP',
    ...overrides,
  }
}

function makeTransactions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `tx-${index + 1}`,
    description: `MOVIMENTO ${index + 1}`,
    customTitle: null,
    amount: '-10.00',
    currency: 'EUR',
    occurredAt: new Date('2026-03-10'),
    categoryType: 'out' as const,
  }))
}

describe('FileDetailClient', () => {
  it('renders two-column layout with visible actions card', async () => {
    const { FileDetailClient } = await import('../components/import/file-detail-client')
    const html = renderToStaticMarkup(
      createElement(FileDetailClient, {
        file: makeFile(),
        transactions: makeTransactions(3),
      }),
    )

    expect(html).toContain('lg:grid-cols-5')
    expect(html).toContain('Azioni')
    expect(html).toContain('Scarica file')
    expect(html).toContain('Rivedi suggerimenti')
    expect(html).toContain('Elimina')
    expect(html).not.toContain('Altre azioni')
  })

  it('renders file-detail layout with collegamenti on row 1 and transactions beside summary', async () => {
    const { FileDetailClient } = await import('../components/import/file-detail-client')
    const html = renderToStaticMarkup(
      createElement(FileDetailClient, {
        file: makeFile({ importedCount: 12 }),
        transactions: makeTransactions(8),
      }),
    )

    expect(html).toContain('lg:grid-cols-5')
    expect(html).toContain('Riepilogo')
    expect(html).toContain('Transazioni')
    expect(html).toContain('Collegamenti')
    expect(html).toContain('lg:row-start-2')
    expect(html).toContain('Mostrate 8 di 12 transazioni importate.')
    expect(html).toContain('href="/transactions?importId=file-1"')
    expect(html).not.toContain('lg:grid-cols-2')
  })

  it('applies neutral transfer tone in transaction preview rows', async () => {
    const { FileDetailClient } = await import('../components/import/file-detail-client')
    const html = renderToStaticMarkup(
      createElement(FileDetailClient, {
        file: makeFile(),
        transactions: [
          {
            id: 'tx-transfer',
            description: 'GIROCONTO',
            customTitle: null,
            amount: '100.00',
            currency: 'EUR',
            occurredAt: new Date('2026-03-10'),
            categoryType: 'transfer',
          },
        ],
      }),
    )

    expect(html).toContain('text-total-transfer/80')
  })
})
