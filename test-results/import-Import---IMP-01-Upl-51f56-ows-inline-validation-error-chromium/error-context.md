# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: import.spec.ts >> Import - IMP-01: Upload page structure >> IMP-01 unsupported file type shows inline validation error
- Location: tests/import.spec.ts:31:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#import-file-error')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#import-file-error')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - navigation [ref=e4]:
        - list [ref=e5]:
          - listitem [ref=e6]:
            - link "Dashboard" [ref=e7] [cursor=pointer]:
              - /url: /dashboard
              - img [ref=e8]
              - generic [ref=e13]: Dashboard
          - listitem [ref=e14]:
            - link "Transazioni" [ref=e15] [cursor=pointer]:
              - /url: /transactions
              - img [ref=e16]
              - generic [ref=e17]: Transazioni
          - listitem [ref=e18]:
            - link "Spese" [ref=e19] [cursor=pointer]:
              - /url: /expenses
              - img [ref=e20]
              - generic [ref=e23]: Spese
          - listitem [ref=e24]:
            - link "Import" [ref=e25] [cursor=pointer]:
              - /url: /import
              - img [ref=e26]
              - generic [ref=e29]: Import
          - listitem [ref=e30]:
            - link "Categorie" [ref=e31] [cursor=pointer]:
              - /url: /categories
              - img [ref=e32]
              - generic [ref=e35]: Categorie
        - list [ref=e37]:
          - listitem [ref=e38]:
            - link "Impostazioni" [ref=e39] [cursor=pointer]:
              - /url: /settings
              - img [ref=e40]
              - generic [ref=e43]: Impostazioni
    - generic [ref=e44]:
      - banner [ref=e45]:
        - generic [ref=e47]: Sparter
        - generic [ref=e48]:
          - button "Tema" [disabled]
          - button "Menu utente" [ref=e49]:
            - generic [ref=e51]: U
      - main [ref=e52]:
        - generic [ref=e53]:
          - generic [ref=e54]:
            - heading "Importa file bancario" [level=1] [ref=e55]
            - paragraph [ref=e56]: Carica un estratto conto per aggiungere le tue transazioni
          - generic [ref=e57]:
            - generic [ref=e58]:
              - generic [ref=e59]: Carica file
              - generic [ref=e60]:
                - text: "Formati supportati:"
                - strong [ref=e61]: .csv
                - text: ","
                - strong [ref=e62]: .xlsx
                - text: — dimensione massima
                - strong [ref=e63]: 5 MB
            - generic [ref=e65]:
              - generic [ref=e66]:
                - generic [ref=e67]: File bancario
                - button "File bancario" [ref=e68]
              - button "Carica file" [disabled]:
                - img
                - text: Carica file
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | // Import page smoke tests
  2   | // Tests that require DB data or R2 are marked fixme — run against staging with seeded DB.
  3   | // Tests verifying UI structure and client-side validation run against local dev.
  4   | // Run: npx playwright test tests/import.spec.ts
  5   | 
  6   | import { expect, test, type Page } from '@playwright/test'
  7   | 
  8   | async function openImportPage(page: Page) {
  9   |   await page.setExtraHTTPHeaders({
  10  |     'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  11  |   })
  12  |   await page.goto('/import')
  13  | }
  14  | 
  15  | test.describe('Import - IMP-01: Upload page structure', () => {
  16  |   test('IMP-01 /import renders page heading and file upload form', async ({ page }) => {
  17  |     await openImportPage(page)
  18  | 
  19  |     await expect(page.getByRole('heading', { name: /importa file bancario/i })).toBeVisible()
  20  |     await expect(page.getByLabel(/file bancario/i)).toBeVisible()
  21  |     await expect(page.getByRole('button', { name: /carica file/i })).toBeVisible()
  22  |   })
  23  | 
  24  |   test('IMP-01 upload button is disabled when no file is selected', async ({ page }) => {
  25  |     await openImportPage(page)
  26  | 
  27  |     const uploadBtn = page.getByRole('button', { name: /carica file/i })
  28  |     await expect(uploadBtn).toBeDisabled()
  29  |   })
  30  | 
  31  |   test('IMP-01 unsupported file type shows inline validation error', async ({ page }) => {
  32  |     await openImportPage(page)
  33  | 
  34  |     const fileInput = page.getByLabel(/file bancario/i)
  35  |     await fileInput.setInputFiles({
  36  |       name: 'statement.pdf',
  37  |       mimeType: 'application/pdf',
  38  |       buffer: Buffer.from('fake pdf content'),
  39  |     })
  40  | 
> 41  |     await expect(page.locator('#import-file-error')).toBeVisible()
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  42  |     await expect(page.getByText(/formato non supportato/i)).toBeVisible()
  43  |   })
  44  | 
  45  |   test('IMP-01 upload form is keyboard-accessible: file input + button are reachable via Tab', async ({ page }) => {
  46  |     await openImportPage(page)
  47  | 
  48  |     // Click the file input label to focus the region, then verify the input is focusable
  49  |     const fileInput = page.locator('#import-file-input')
  50  |     await fileInput.focus()
  51  |     const focused = await page.evaluate(() => document.activeElement?.id ?? '')
  52  |     expect(focused).toBe('import-file-input')
  53  |   })
  54  | })
  55  | 
  56  | test.describe('Import - IMP-01: Accepted file validation', () => {
  57  |   test('IMP-01 valid CSV file clears error and enables upload button', async ({ page }) => {
  58  |     await openImportPage(page)
  59  | 
  60  |     const fileInput = page.getByLabel(/file bancario/i)
  61  |     await fileInput.setInputFiles({
  62  |       name: 'statement.csv',
  63  |       mimeType: 'text/csv',
  64  |       buffer: Buffer.from('date,description,amount\n2024-01-01,Test,100.00'),
  65  |     })
  66  | 
  67  |     // No validation error alert visible
  68  |     await expect(page.locator('#import-file-error')).not.toBeVisible()
  69  |     // Upload button should no longer be disabled
  70  |     await expect(page.getByRole('button', { name: /carica file/i })).not.toBeDisabled()
  71  |   })
  72  | })
  73  | 
  74  | test.describe('Import - IMP-01: Upload retry integration', () => {
  75  |   test('IMP-01 retries transient presigned PUT failures and confirms only after upload success', async ({ page }) => {
  76  |     const fileId = '00000000-0000-4000-8000-000000000123'
  77  |     const presignedUrl = 'https://r2-upload.test/imports/statement.csv?signature=secret-signature'
  78  |     const putRequestOrder: number[] = []
  79  |     let confirmCalledAtPutAttempt: number | null = null
  80  | 
  81  |     await page.addInitScript(() => {
  82  |       window.addEventListener('upload-put-diagnostic', (event) => {
  83  |         const detail = event instanceof CustomEvent ? event.detail : null
  84  |         const current = (window as Window & { __uploadPutDiagnostics?: unknown[] }).__uploadPutDiagnostics ?? []
  85  |         ;(window as unknown as Window & { __uploadPutDiagnostics: unknown[] }).__uploadPutDiagnostics = [...current, detail]
  86  |       })
  87  |     })
  88  | 
  89  |     await page.route('**/api/files/initiate', async (route) => {
  90  |       expect(route.request().method()).toBe('POST')
  91  |       const body = route.request().postDataJSON() as { name: string; size: number; type: string }
  92  |       expect(body).toMatchObject({ name: 'statement.csv', type: 'text/csv' })
  93  |       expect(body.size).toBeGreaterThan(0)
  94  |       await route.fulfill({
  95  |         status: 200,
  96  |         contentType: 'application/json',
  97  |         body: JSON.stringify({
  98  |           file: {
  99  |             id: fileId,
  100 |             originalName: body.name,
  101 |             status: 'pending',
  102 |             sizeBytes: body.size,
  103 |             mimeType: body.type,
  104 |           },
  105 |           upload: {
  106 |             method: 'PUT',
  107 |             url: presignedUrl,
  108 |             expiresIn: 900,
  109 |             headers: { 'Content-Type': body.type },
  110 |           },
  111 |         }),
  112 |       })
  113 |     })
  114 | 
  115 |     await page.route('https://r2-upload.test/imports/statement.csv**', async (route) => {
  116 |       const request = route.request()
  117 |       if (request.method() === 'OPTIONS') {
  118 |         await route.fulfill({
  119 |           status: 204,
  120 |           headers: {
  121 |             'access-control-allow-origin': '*',
  122 |             'access-control-allow-methods': 'PUT, OPTIONS',
  123 |             'access-control-allow-headers': 'content-type, content-length',
  124 |           },
  125 |         })
  126 |         return
  127 |       }
  128 | 
  129 |       expect(request.method()).toBe('PUT')
  130 |       putRequestOrder.push(putRequestOrder.length + 1)
  131 |       await route.fulfill({
  132 |         status: putRequestOrder.length < 3 ? 503 : 200,
  133 |         headers: {
  134 |           'access-control-allow-origin': '*',
  135 |           'access-control-expose-headers': 'etag',
  136 |         },
  137 |         body: putRequestOrder.length < 3 ? 'temporary unavailable' : '',
  138 |       })
  139 |     })
  140 | 
  141 |     await page.route('**/api/files/confirm', async (route) => {
```