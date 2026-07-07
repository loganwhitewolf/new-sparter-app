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

const { ExpenseTitleEdit } = await import('../components/expenses/expense-title-edit')
const { expenseDetailHref } = await import('../lib/routes')

const EXPENSE_ID = '22222222-2222-4222-8222-222222222222'

describe('ExpenseTitleEdit', () => {
  it('shows the expense title as visible text', () => {
    const html = renderToStaticMarkup(
      createElement(ExpenseTitleEdit, {
        id: EXPENSE_ID,
        title: 'Spesa supermercato',
      }),
    )

    expect(html).toContain('Spesa supermercato')
  })

  it('renders the title as a link to the expense detail page', () => {
    const html = renderToStaticMarkup(
      createElement(ExpenseTitleEdit, {
        id: EXPENSE_ID,
        title: 'Spesa supermercato',
      }),
    )

    expect(html).toContain(`href="${expenseDetailHref(EXPENSE_ID)}"`)
  })

  it('renders the pencil trigger as a plain button, not wrapped in the link', () => {
    const html = renderToStaticMarkup(
      createElement(ExpenseTitleEdit, {
        id: EXPENSE_ID,
        title: 'Spesa supermercato',
      }),
    )

    const pencilButtonMatch = html.match(
      /<button[^>]*aria-label="Rinomina spesa"[^>]*>/,
    )
    expect(pencilButtonMatch).not.toBeNull()
    expect(pencilButtonMatch?.[0]).not.toContain('href')
  })
})
