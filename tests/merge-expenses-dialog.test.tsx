import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * MergeExpensesDialog test strategy (repo constraint: no jsdom/@testing-library
 * configured — see tests/connected-accounts-card.test.tsx's it.todo precedent).
 * renderToStaticMarkup cannot simulate typing/clicking through a multi-step
 * dialog, so the title -> categorize-first -> confirm decision logic (GRP-02)
 * is extracted as pure/async exports and unit-tested directly:
 *  - isGroupTitleValid: the >=2-char gate
 *  - nextStepAfterTitle: routes to 'categorize' when ANY selected expense is
 *    uncategorized (including all-uncategorized), else straight to 'confirm'
 *  - getUncategorizedIds: scopes bulkCategorize to only uncategorized ids
 *  - runCategorizeStep / runMergeStep: thin async wrappers around
 *    bulkCategorize/mergeExpenses whose FormData payload we assert on via the
 *    mocked action calls
 * A static-render smoke test (Dialog/SubcategoryPicker mocked as passthrough,
 * same technique as tests/subcategory-picker.test.tsx's Sheet mock) covers the
 * initial title-step UI structure.
 */

vi.mock('@/lib/actions/expenses', () => ({
  bulkCategorize: vi.fn(),
  mergeExpenses: vi.fn(),
  addExpensesToGroupAction: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog' }, children),
  DialogContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-content' }, children),
  DialogHeader: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-header' }, children),
  DialogTitle: ({ children }: { children?: ReactNode }) =>
    createElement('h2', { 'data-slot': 'dialog-title' }, children),
  DialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement('p', { 'data-slot': 'dialog-description' }, children),
  DialogFooter: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'dialog-footer' }, children),
}))

vi.mock('@/components/categorization/subcategory-picker', () => ({
  SubcategoryPicker: ({ open }: { open: boolean }) =>
    open ? createElement('div', { 'data-slot': 'subcategory-picker' }) : null,
}))

const {
  MergeExpensesDialog,
  isGroupTitleValid,
  nextStepAfterTitle,
  getUncategorizedIds,
  runCategorizeStep,
  runMergeStep,
  runAddToGroupStep,
} = await import('../components/expenses/merge-expenses-dialog')
const { bulkCategorize, mergeExpenses, addExpensesToGroupAction } = await import(
  '../lib/actions/expenses'
)

const bulkCategorizeMock = vi.mocked(bulkCategorize)
const mergeExpensesMock = vi.mocked(mergeExpenses)
const addExpensesToGroupActionMock = vi.mocked(addExpensesToGroupAction)

beforeEach(() => {
  bulkCategorizeMock.mockReset()
  mergeExpensesMock.mockReset()
  addExpensesToGroupActionMock.mockReset()
})

describe('isGroupTitleValid (GRP-02 title gate)', () => {
  it('is false below 2 trimmed characters', () => {
    expect(isGroupTitleValid('')).toBe(false)
    expect(isGroupTitleValid('a')).toBe(false)
    expect(isGroupTitleValid('  a  ')).toBe(false)
  })

  it('is true at 2+ trimmed characters', () => {
    expect(isGroupTitleValid('ab')).toBe(true)
    expect(isGroupTitleValid('  ab  ')).toBe(true)
  })
})

describe('nextStepAfterTitle (GRP-02 categorize-first routing)', () => {
  it('routes straight to confirm when every selected expense already shares one non-null subCategoryId', () => {
    const step = nextStepAfterTitle([
      { id: 'e1', subCategoryId: 10 },
      { id: 'e2', subCategoryId: 10 },
    ])
    expect(step).toBe('confirm')
  })

  it('routes to categorize when ANY selected expense is uncategorized', () => {
    const step = nextStepAfterTitle([
      { id: 'e1', subCategoryId: 10 },
      { id: 'e2', subCategoryId: null },
    ])
    expect(step).toBe('categorize')
  })

  it('routes to categorize when ALL selected expenses are uncategorized (empty edge)', () => {
    const step = nextStepAfterTitle([
      { id: 'e1', subCategoryId: null },
      { id: 'e2', subCategoryId: null },
    ])
    expect(step).toBe('categorize')
  })
})

describe('getUncategorizedIds (bulkCategorize scoping)', () => {
  it('returns only the ids with a null subCategoryId', () => {
    const ids = getUncategorizedIds([
      { id: 'e1', subCategoryId: 10 },
      { id: 'e2', subCategoryId: null },
      { id: 'e3', subCategoryId: null },
    ])
    expect(ids).toEqual(['e2', 'e3'])
  })
})

describe('runCategorizeStep (calls bulkCategorize scoped to uncategorized ids only)', () => {
  it('calls bulkCategorize with only the uncategorized ids and the chosen subCategoryId', async () => {
    bulkCategorizeMock.mockResolvedValue({ error: null })

    const result = await runCategorizeStep({
      selectedExpenses: [
        { id: 'e1', subCategoryId: 10 },
        { id: 'e2', subCategoryId: null },
      ],
      subCategoryId: '20',
    })

    expect(result.error).toBeNull()
    expect(bulkCategorizeMock).toHaveBeenCalledTimes(1)
    const [, formData] = bulkCategorizeMock.mock.calls[0]
    expect(JSON.parse(formData.get('ids') as string)).toEqual(['e2'])
    expect(formData.get('subCategoryId')).toBe('20')
  })

  it('propagates an error result without throwing (component shows toast, stays on step)', async () => {
    bulkCategorizeMock.mockResolvedValue({ error: 'Errore di categorizzazione.' })

    const result = await runCategorizeStep({
      selectedExpenses: [{ id: 'e1', subCategoryId: null }],
      subCategoryId: '20',
    })

    expect(result.error).toBe('Errore di categorizzazione.')
  })
})

describe('runMergeStep (calls mergeExpenses with the FULL original id set)', () => {
  it('calls mergeExpenses with every selected id, even ones categorized during the categorize step', async () => {
    mergeExpensesMock.mockResolvedValue({ error: null })

    const result = await runMergeStep({
      selectedExpenses: [
        { id: 'e1', subCategoryId: 10 },
        { id: 'e2', subCategoryId: null },
      ],
      groupTitle: 'Netflix',
    })

    expect(result.error).toBeNull()
    expect(mergeExpensesMock).toHaveBeenCalledTimes(1)
    const [, formData] = mergeExpensesMock.mock.calls[0]
    expect(JSON.parse(formData.get('selectedExpenseIds') as string)).toEqual(['e1', 'e2'])
    expect(formData.get('groupTitle')).toBe('Netflix')
  })

  it('propagates an error result without throwing', async () => {
    mergeExpensesMock.mockResolvedValue({ error: 'Le spese devono avere la stessa categoria.' })

    const result = await runMergeStep({
      selectedExpenses: [{ id: 'e1', subCategoryId: 10 }],
      groupTitle: 'Netflix',
    })

    expect(result.error).toBe('Le spese devono avere la stessa categoria.')
  })
})

describe('runAddToGroupStep (add-to-group, targetGroup mode)', () => {
  it('calls bulkCategorize scoped to only uncategorized ids THEN addExpensesToGroupAction with the full id set, when the selection has an uncategorized member', async () => {
    bulkCategorizeMock.mockResolvedValue({ error: null })
    addExpensesToGroupActionMock.mockResolvedValue({ error: null })

    const result = await runAddToGroupStep({
      selectedExpenses: [
        { id: 'e1', subCategoryId: 10 },
        { id: 'e2', subCategoryId: null },
      ],
      targetGroupId: 7,
      targetSubCategoryId: 10,
    })

    expect(result.error).toBeNull()
    expect(bulkCategorizeMock).toHaveBeenCalledTimes(1)
    const [, categorizeFd] = bulkCategorizeMock.mock.calls[0]
    expect(JSON.parse(categorizeFd.get('ids') as string)).toEqual(['e2'])
    expect(categorizeFd.get('subCategoryId')).toBe('10')

    expect(addExpensesToGroupActionMock).toHaveBeenCalledTimes(1)
    const [, addFd] = addExpensesToGroupActionMock.mock.calls[0]
    expect(addFd.get('groupId')).toBe('7')
    expect(JSON.parse(addFd.get('expenseIds') as string)).toEqual(['e1', 'e2'])
  })

  it('calls addExpensesToGroupAction directly (bulkCategorize NOT called) when every selected expense is already categorized', async () => {
    addExpensesToGroupActionMock.mockResolvedValue({ error: null })

    const result = await runAddToGroupStep({
      selectedExpenses: [
        { id: 'e1', subCategoryId: 10 },
        { id: 'e2', subCategoryId: 10 },
      ],
      targetGroupId: 7,
      targetSubCategoryId: 10,
    })

    expect(result.error).toBeNull()
    expect(bulkCategorizeMock).not.toHaveBeenCalled()
    expect(addExpensesToGroupActionMock).toHaveBeenCalledTimes(1)
  })

  it('propagates a bulkCategorize error without calling addExpensesToGroupAction', async () => {
    bulkCategorizeMock.mockResolvedValue({ error: 'Errore di categorizzazione.' })

    const result = await runAddToGroupStep({
      selectedExpenses: [{ id: 'e1', subCategoryId: null }],
      targetGroupId: 7,
      targetSubCategoryId: 10,
    })

    expect(result.error).toBe('Errore di categorizzazione.')
    expect(addExpensesToGroupActionMock).not.toHaveBeenCalled()
  })

  it('propagates an addExpensesToGroupAction error', async () => {
    addExpensesToGroupActionMock.mockResolvedValue({ error: 'Selezione non valida.' })

    const result = await runAddToGroupStep({
      selectedExpenses: [{ id: 'e1', subCategoryId: 10 }],
      targetGroupId: 7,
      targetSubCategoryId: 10,
    })

    expect(result.error).toBe('Selezione non valida.')
  })
})

describe('MergeExpensesDialog (render smoke test — title step)', () => {
  it('renders the title step with the primary button disabled by default (empty title)', () => {
    const html = renderToStaticMarkup(
      createElement(MergeExpensesDialog, {
        open: true,
        onOpenChange: vi.fn(),
        selectedExpenses: [
          { id: 'e1', subCategoryId: 10 },
          { id: 'e2', subCategoryId: 10 },
        ],
        categories: [],
        mostUsed: [],
        onSuccess: vi.fn(),
      }),
    )

    expect(html).toContain('data-slot="dialog-content"')
    expect(html).toContain('disabled=""')
  })

  it('renders the confirm step immediately when targetGroup is set (add-to-group mode, no title step)', () => {
    const html = renderToStaticMarkup(
      createElement(MergeExpensesDialog, {
        open: true,
        onOpenChange: vi.fn(),
        selectedExpenses: [
          { id: 'e1', subCategoryId: 10 },
          { id: 'e2', subCategoryId: 10 },
        ],
        categories: [],
        mostUsed: [],
        targetGroup: { id: 7, title: 'Amazon condiviso', subCategoryId: 42 },
        onSuccess: vi.fn(),
      }),
    )

    expect(html).toContain('Amazon condiviso')
    expect(html).toContain('Aggiungi')
    expect(html).not.toContain('placeholder="Titolo del gruppo"')
  })
})
