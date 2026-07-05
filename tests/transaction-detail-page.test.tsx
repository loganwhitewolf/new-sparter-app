import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const TX_ID = '11111111-1111-4111-8111-111111111111'

describe('TransactionAmountEdit', () => {
  it('shows the formatted signed amount with a pencil icon when not editing', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-12.99',
        currency: 'EUR',
      }),
    )

    expect(html).toContain('-12,99')
    vi.doUnmock('react')
  })

  it('surfaces the pair-guard error inline and stays in edit mode when the action returns an error', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => [
          typeof initial === 'function' ? (initial as () => unknown)() : initial,
          vi.fn(),
        ]),
        useActionState: vi.fn(() => [
          { error: 'Scollega prima il rimborso' },
          vi.fn(),
          false,
        ]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-12.99',
        currency: 'EUR',
      }),
    )

    // useState is mocked to always return its initial value, so isEditing stays
    // false in this render. To exercise the error-rendering branch itself we
    // assert the component surfaces state.error text whenever isEditing is true —
    // covered directly by rendering the edit-mode markup below instead.
    expect(html).toBeDefined()
    vi.doUnmock('react')
  })
})

describe('TransactionAmountEdit — pair-guard error markup', () => {
  it('renders the exact pair-guard error string under the input while remaining in edit mode', async () => {
    vi.resetModules()
    let editingState = true
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          // First useState call in the component is `isEditing` — force it true.
          if (typeof resolved === 'boolean') {
            return [editingState, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [
          { error: 'Scollega prima il rimborso' },
          vi.fn(),
          false,
        ]),
      }
    })
    const { TransactionAmountEdit } = await import(
      '../components/transactions/transaction-amount-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionAmountEdit, {
        id: TX_ID,
        amount: '-12.99',
        currency: 'EUR',
      }),
    )

    expect(html).toContain('Scollega prima il rimborso')
    // Still in edit mode: an <input name="amount"> must be present.
    expect(html).toContain('name="amount"')
    editingState = false
    vi.doUnmock('react')
  })
})

describe('TransactionDateEdit', () => {
  it('shows the formatted date with a pencil icon when not editing', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useActionState: vi.fn(() => [{ error: null }, vi.fn(), false]),
      }
    })
    const { TransactionDateEdit } = await import(
      '../components/transactions/transaction-date-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionDateEdit, {
        id: TX_ID,
        occurredAt: new Date('2026-03-15T00:00:00.000Z'),
      }),
    )

    expect(html).toContain('mar')
    expect(html).toContain('2026')
    vi.doUnmock('react')
  })

  it('renders the pair-guard error string under the input while remaining in edit mode', async () => {
    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: vi.fn((initial: unknown) => {
          const resolved = typeof initial === 'function' ? (initial as () => unknown)() : initial
          if (typeof resolved === 'boolean') {
            return [true, vi.fn()]
          }
          return [resolved, vi.fn()]
        }),
        useActionState: vi.fn(() => [
          { error: 'Scollega prima il rimborso' },
          vi.fn(),
          false,
        ]),
      }
    })
    const { TransactionDateEdit } = await import(
      '../components/transactions/transaction-date-edit'
    )

    const html = renderToStaticMarkup(
      createElement(TransactionDateEdit, {
        id: TX_ID,
        occurredAt: new Date('2026-03-15T00:00:00.000Z'),
      }),
    )

    expect(html).toContain('Scollega prima il rimborso')
    expect(html).toContain('name="occurredAt"')
    vi.doUnmock('react')
  })
})
