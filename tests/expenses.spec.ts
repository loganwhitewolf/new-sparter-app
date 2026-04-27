import { expect, test } from '@playwright/test'

test.describe('Expenses - EXP-01: Create', () => {
  test('create expense: form submit creates row visible in list', async () => {
    test.fixme()
    // EXP-01: "Nuova spesa" dialog → fill titolo + subcategoria → "Salva spesa" → row appears in table
    // Implement when Plan 04 (page + components) is complete
  })

  test('edit expense: modal pre-fills existing data, update persists', async () => {
    test.fixme()
    // EXP-01: Three-dots menu → "Modifica" → dialog opens with existing values pre-filled → "Aggiorna spesa" → table row updated
    // Implement when Plan 04 (page + components) is complete
  })

  test('delete expense: confirm dialog removes row from list', async () => {
    test.fixme()
    // EXP-01: Three-dots menu → "Elimina" → confirm dialog → "Elimina" button → row removed from table
    // Implement when Plan 04 (page + components) is complete
  })
})

test.describe('Expenses - EXP-02: Filters', () => {
  test('filter by status "Da categorizzare" shows only status=1 expenses', async () => {
    test.fixme()
    // EXP-02: Select "Da categorizzare" in Stato filter → URL gains ?status=uncategorized → only uncategorized expenses shown
    // Implement when Plan 04 (page + components) is complete
  })

  test('filter by period "Questo mese" excludes older expenses', async () => {
    test.fixme()
    // EXP-02: Select "Questo mese" → URL gains ?period=this-month → expenses older than current month not shown
    // Implement when Plan 04 (page + components) is complete
  })

  test('filter params survive page refresh', async ({ page }) => {
    test.fixme()
    // EXP-02: Set ?category=ristorazione&status=uncategorized → reload page → same URL → same results
    // Implement when Plan 04 (page + components) is complete
  })
})

test.describe('Expenses - EXP-03: Bulk Categorization', () => {
  test('select N rows: floating action bar appears with correct count', async () => {
    test.fixme()
    // EXP-03: Check 2 checkboxes → FAB appears with text "2 selezionate" and button "Categorizza (2)"
    // Implement when Plan 04 (page + components) is complete
  })

  test('bulk categorize: assigns subCategory + status=3 to all selected expenses', async () => {
    test.fixme()
    // EXP-03: Select 2 expenses → "Categorizza (2)" → bulk dialog → pick subcategory → "Conferma" → both rows show status=3 + new category badge
    // Implement when Plan 04 (page + components) is complete
  })
})
