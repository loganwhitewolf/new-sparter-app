import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const { ImportDeleteImpactSummary } = await import(
  '../components/import/import-delete-impact-summary'
)

const basePreview = {
  fileId: '8f8ad4cf-d51d-4f39-80b4-c220e7a4a96f',
  displayName: 'estratto-gennaio.csv',
  transactionCount: 8,
  affectedExpenseIds: ['expense-1', 'expense-2', 'expense-3'],
  recalculatedExpenseIds: ['expense-1'],
  deletedExpenseIds: ['expense-2'],
  preservedExpenseIds: ['expense-3'],
  counts: {
    transactions: 8,
    affectedExpenses: 3,
    recalculatedExpenses: 1,
    deletedExpenses: 1,
    preservedExpenses: 1,
  },
}

describe('ImportDeleteImpactSummary', () => {
  it('renders deletion impact counts and manual preservation copy', () => {
    const html = renderToStaticMarkup(
      createElement(ImportDeleteImpactSummary, { preview: basePreview }),
    )

    expect(html).toContain('estratto-gennaio.csv')
    expect(html).toContain('8 transazioni importate')
    expect(html).toContain('3 spese interessate')
    expect(html).toContain('1 spesa ricalcolata')
    expect(html).toContain('1 spesa vuota eliminata')
    expect(html).toContain('1 spesa manuale o corretta preservata')
    expect(html).toContain('manuale')
    expect(html).toContain('override')
  })

  it('renders zero preserved copy without implying manual history will be deleted', () => {
    const preview = {
      ...basePreview,
      preservedExpenseIds: [],
      counts: {
        ...basePreview.counts,
        preservedExpenses: 0,
      },
    }

    const html = renderToStaticMarkup(
      createElement(ImportDeleteImpactSummary, { preview }),
    )

    expect(html).toContain('0 spese manuali o corrette preservate')
    expect(html).toContain('Non ci sono spese manuali o override da preservare')
  })

  it('does not render raw storage or database diagnostics from unexpected payload fields', () => {
    const preview = {
      ...basePreview,
      objectKey: 'users/u-1/imports/private.csv',
      rawRow: 'IBAN;Saldo;Movimento',
      stack: 'Error: database failed at storage.ts:10',
      presignedUrl: 'https://r2.example.com/private?X-Amz-Signature=secret',
    }

    const html = renderToStaticMarkup(
      createElement(ImportDeleteImpactSummary, { preview }),
    )

    expect(html).not.toContain('users/u-1/imports/private.csv')
    expect(html).not.toContain('IBAN;Saldo;Movimento')
    expect(html).not.toContain('database failed')
    expect(html).not.toContain('X-Amz-Signature')
  })
})
