# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: expenses.spec.ts >> S04 searchable category combobox >> single categorize dialog: no-results state and disabled submit for nonsense query
- Location: tests/expenses.spec.ts:126:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /categorizza/i }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e5]: Sparter
    - generic [ref=e6]:
      - generic [ref=e7]:
        - heading "Accedi" [level=1] [ref=e8]
        - paragraph [ref=e9]: Inserisci le tue credenziali per accedere.
      - generic [ref=e10]:
        - textbox "Email" [ref=e11]
        - textbox "Password" [ref=e12]
        - button "Accedi" [ref=e13]
      - paragraph [ref=e14]:
        - text: Non hai un account?
        - link "Registrati" [ref=e15] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e21] [cursor=pointer]:
    - img [ref=e22]
  - alert [ref=e25]
```

# Test source

```ts
  31  |   test('delete expense: confirm dialog removes row from list', async ({ page }) => {
  32  |     test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  33  |     // Three-dots menu → localized delete action → confirm dialog → localized delete button → row removed from table
  34  |     await page.goto('/expenses')
  35  |   })
  36  | })
  37  | 
  38  | test.describe('Expenses - EXP-02: Filters', () => {
  39  |   test('filter by status "Da categorizzare" shows only status=1 expenses', async ({ page }) => {
  40  |     test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  41  |     // Select the localized uncategorized option in the status filter → URL gains ?status=uncategorized
  42  |     // → only uncategorized expenses shown
  43  |     await page.goto('/expenses')
  44  |   })
  45  | 
  46  |   test('filter by period "Questo mese" excludes older expenses', async ({ page }) => {
  47  |     test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  48  |     // Select the localized current-month option → URL gains ?period=this-month
  49  |     // → expenses older than current month not shown
  50  |     await page.goto('/expenses')
  51  |   })
  52  | 
  53  |   test('filter URL persistence: status param reflected in select', async ({ page }) => {
  54  |     test.fixme(true, 'Requires seeded DB for filter results — URL param reading can be tested standalone')
  55  |     // Navigate with ?status=uncategorized → the localized status select shows the correct value
  56  |     // This does not require DB data for the URL reading itself
  57  |     await page.goto('/expenses?status=uncategorized')
  58  |     await expect(page.getByRole('combobox', { name: /stato/i })).toHaveValue('uncategorized')
  59  |   })
  60  | })
  61  | 
  62  | test.describe('Expenses - EXP-03: Bulk Categorization', () => {
  63  |   test('select N rows: floating action bar appears with correct count', async ({ page }) => {
  64  |     test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  65  |     // Check 2 checkboxes → FAB appears with localized selected-count text and categorize button
  66  |     await page.goto('/expenses')
  67  |   })
  68  | 
  69  |   test('bulk categorize: assigns subCategory + status=3 to all selected expenses', async ({ page }) => {
  70  |     test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  71  |     // Select 2 expenses → localized categorize button → bulk dialog → pick subcategory
  72  |     // → localized confirm button → both rows show status=3 + new category badge
  73  |     await page.goto('/expenses')
  74  |   })
  75  | })
  76  | 
  77  | // ---------------------------------------------------------------------------
  78  | // S04 — Searchable category combobox (regression coverage)
  79  | // ---------------------------------------------------------------------------
  80  | // Seed requirement: an uncategorized expense must exist in the DB for the
  81  | // single-categorize dialog tests to open. A user-owned subcategory must be
  82  | // present to verify the Personale badge. All tests below are gated with
  83  | // test.fixme when PLAYWRIGHT_BASE_URL is not set (no staging DB available).
  84  | // ---------------------------------------------------------------------------
  85  | 
  86  | test.describe('S04 searchable category combobox', () => {
  87  |   const requiresDB = !process.env.PLAYWRIGHT_BASE_URL
  88  | 
  89  |   test('single categorize dialog: opens combobox, types ristoranti, matching subcategory appears', async ({
  90  |     page,
  91  |   }) => {
  92  |     test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  93  |     // Navigate to /expenses, open the single categorize dialog for an uncategorized expense,
  94  |     // open the combobox, type "ristoranti", and assert the matching subcategory is visible.
  95  |     await page.goto('/expenses')
  96  |     // Open the categorize action for the first uncategorized expense row.
  97  |     await page.getByRole('button', { name: /categorizza/i }).first().click()
  98  |     await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
  99  |     // The combobox trigger button is present and the confirm button is disabled initially.
  100 |     const confirmBtn = page.getByRole('button', { name: /conferma/i })
  101 |     await expect(confirmBtn).toBeDisabled()
  102 |     // Open the combobox.
  103 |     await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
  104 |     await expect(page.getByPlaceholder('Cerca categoria…')).toBeVisible()
  105 |     // Type the search term — the matching subcategory must appear.
  106 |     await page.getByPlaceholder('Cerca categoria…').fill('ristoranti')
  107 |     await expect(page.getByRole('option', { name: /ristoranti/i }).first()).toBeVisible()
  108 |     // Confirm button is still disabled (nothing selected yet).
  109 |     await expect(confirmBtn).toBeDisabled()
  110 |   })
  111 | 
  112 |   test('single categorize dialog: Personale badge visible for user-owned subcategory', async ({
  113 |     page,
  114 |   }) => {
  115 |     test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  116 |     // Seed requirement: at least one user-owned subcategory must exist in the DB.
  117 |     await page.goto('/expenses')
  118 |     await page.getByRole('button', { name: /categorizza/i }).first().click()
  119 |     await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
  120 |     await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
  121 |     // Search without a term to show all options.
  122 |     const personaleLocator = page.locator('text=Personale')
  123 |     await expect(personaleLocator.first()).toBeVisible()
  124 |   })
  125 | 
  126 |   test('single categorize dialog: no-results state and disabled submit for nonsense query', async ({
  127 |     page,
  128 |   }) => {
  129 |     test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  130 |     await page.goto('/expenses')
> 131 |     await page.getByRole('button', { name: /categorizza/i }).first().click()
      |                                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  132 |     await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
  133 |     const confirmBtn = page.getByRole('button', { name: /conferma/i })
  134 |     await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
  135 |     await page.getByPlaceholder('Cerca categoria…').fill('zzznonexistent999')
  136 |     // The Italian no-results message must be visible.
  137 |     await expect(page.getByText('Nessuna sottocategoria trovata.')).toBeVisible()
  138 |     // Confirm button remains disabled.
  139 |     await expect(confirmBtn).toBeDisabled()
  140 |   })
  141 | 
  142 |   test('single categorize dialog: confirm button enables after selecting a subcategory', async ({
  143 |     page,
  144 |   }) => {
  145 |     test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
  146 |     await page.goto('/expenses')
  147 |     await page.getByRole('button', { name: /categorizza/i }).first().click()
  148 |     await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
  149 |     const confirmBtn = page.getByRole('button', { name: /conferma/i })
  150 |     await expect(confirmBtn).toBeDisabled()
  151 |     // Open combobox and select the first visible option.
  152 |     await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
  153 |     await page.getByRole('option').first().click()
  154 |     // Confirm button must now be enabled.
  155 |     await expect(confirmBtn).toBeEnabled()
  156 |   })
  157 | })
  158 | 
```