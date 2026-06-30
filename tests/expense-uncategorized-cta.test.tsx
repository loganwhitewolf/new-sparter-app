import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mockUpdateParam = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('@/components/data-table/use-table-url', () => ({
  useTableUrl: () => ({
    searchParams: mockSearchParams,
    isPending: false,
    updateParam: mockUpdateParam,
    updateParams: vi.fn(),
    replaceWith: vi.fn(),
  }),
}))

const { ExpenseUncategorizedCta } = await import('@/components/expenses/expense-uncategorized-cta')

describe('ExpenseUncategorizedCta', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams()
    mockUpdateParam.mockClear()
  })

  it('renders nothing when count is 0 and filter is inactive', () => {
    const html = renderToStaticMarkup(
      <ExpenseUncategorizedCta uncategorizedCount={0} route="/expenses" />,
    )
    expect(html).toBe('')
  })

  it('renders pill with count when uncategorized expenses exist', () => {
    const html = renderToStaticMarkup(
      <ExpenseUncategorizedCta uncategorizedCount={12} route="/expenses" />,
    )
    expect(html).toContain('Da categorizzare')
    expect(html).toContain('>12<')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('data-size="sm"')
  })

  it('renders active state when status=uncategorized is in the URL', () => {
    mockSearchParams = new URLSearchParams('status=uncategorized')
    const html = renderToStaticMarkup(
      <ExpenseUncategorizedCta uncategorizedCount={5} route="/expenses" />,
    )
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('ring-primary/20')
    expect(html).toContain('bg-primary/10')
  })

  it('still renders when count is 0 but filter is active (toggle off)', () => {
    mockSearchParams = new URLSearchParams('status=uncategorized')
    const html = renderToStaticMarkup(
      <ExpenseUncategorizedCta uncategorizedCount={0} route="/expenses" />,
    )
    expect(html).toContain('Da categorizzare')
    expect(html).toContain('>0<')
    expect(html).toContain('aria-pressed="true"')
  })
})
