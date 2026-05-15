# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: import.spec.ts >> Import - IMP-01: Upload page structure >> IMP-01 upload button is disabled when no file is selected
- Location: tests/import.spec.ts:38:7

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: getByRole('button', { name: /carica file/i })
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 5000ms
  - waiting for getByRole('button', { name: /carica file/i })

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
            - link "Importazioni" [ref=e25] [cursor=pointer]:
              - /url: /import
              - img [ref=e26]
              - generic [ref=e29]: Importazioni
        - list [ref=e31]:
          - listitem [ref=e32]:
            - link "Impostazioni" [ref=e33] [cursor=pointer]:
              - /url: /settings
              - img [ref=e34]
              - generic [ref=e37]: Impostazioni
    - generic [ref=e38]:
      - banner [ref=e39]:
        - generic [ref=e41]: Sparter
        - generic [ref=e42]:
          - button "Passa al tema scuro" [ref=e43]:
            - img
          - button "Menu utente" [ref=e44]:
            - generic [ref=e46]: U
      - main [ref=e47]:
        - generic [ref=e48]:
          - generic [ref=e49]:
            - generic [ref=e50]:
              - heading "Importazioni" [level=1] [ref=e51]
              - paragraph [ref=e52]: Storico dei file bancari caricati
            - button "Importa file" [ref=e53]:
              - img
              - text: Importa file
          - generic [ref=e54]:
            - generic [ref=e56]:
              - generic [ref=e57]:
                - generic [ref=e58]: Cerca importazione
                - generic [ref=e59]:
                  - img
                  - searchbox "Cerca importazione" [ref=e60]
              - generic [ref=e61]:
                - generic [ref=e62]: Importato da
                - textbox "Importato da" [ref=e63]
              - generic [ref=e64]:
                - generic [ref=e65]: Importato a
                - textbox "Importato a" [ref=e66]
              - generic [ref=e67]:
                - generic [ref=e68]: Riferimento da
                - textbox "Riferimento da" [ref=e69]
              - generic [ref=e70]:
                - generic [ref=e71]: Riferimento a
                - textbox "Riferimento a" [ref=e72]
              - button "Reset filtri" [disabled]:
                - img
                - generic: Reset filtri
            - generic [ref=e74]:
              - paragraph [ref=e75]: Nessuna importazione trovata
              - paragraph [ref=e76]: Carica un estratto conto per vedere qui stato, statistiche e intervallo di riferimento delle prossime importazioni.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e82] [cursor=pointer]:
    - img [ref=e83]
  - alert [ref=e86]
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
  22  |     await expect(page.getByRole('heading', { name: /storico importazioni/i })).toBeVisible()
  23  | 
  24  |     const historyTable = page.getByRole('table', { name: /storico importazioni/i })
  25  |     const emptyState = page.getByText(/nessuna importazione trovata/i)
  26  |     const safeErrorState = page.getByText(/storico importazioni non disponibile/i)
  27  | 
  28  |     await expect(historyTable.or(emptyState).or(safeErrorState)).toBeVisible()
  29  | 
  30  |     if (await historyTable.isVisible()) {
  31  |       await expect(page.getByRole('columnheader', { name: /file/i })).toBeVisible()
  32  |       await expect(page.getByRole('columnheader', { name: /stato/i })).toBeVisible()
  33  |       await expect(page.getByRole('columnheader', { name: /piattaforma/i })).toBeVisible()
  34  |       await expect(page.getByRole('columnheader', { name: /righe/i })).toBeVisible()
  35  |     }
  36  |   })
  37  | 
  38  |   test('IMP-01 upload button is disabled when no file is selected', async ({ page }) => {
  39  |     await openImportPage(page)
  40  | 
  41  |     const uploadBtn = page.getByRole('button', { name: /carica file/i })
> 42  |     await expect(uploadBtn).toBeDisabled()
      |                             ^ Error: expect(locator).toBeDisabled() failed
  43  |   })
  44  | 
  45  |   test('IMP-01 unsupported file type shows inline validation error', async ({ page }) => {
  46  |     await openImportPage(page)
  47  | 
  48  |     const fileInput = page.getByLabel(/file bancario/i)
  49  |     await fileInput.setInputFiles({
  50  |       name: 'statement.pdf',
  51  |       mimeType: 'application/pdf',
  52  |       buffer: Buffer.from('fake pdf content'),
  53  |     })
  54  | 
  55  |     await expect(page.locator('#import-file-error')).toBeVisible()
  56  |     await expect(page.getByText(/formato non supportato/i)).toBeVisible()
  57  |   })
  58  | 
  59  |   test('IMP-01 upload form is keyboard-accessible: file input + button are reachable via Tab', async ({ page }) => {
  60  |     await openImportPage(page)
  61  | 
  62  |     // Click the file input label to focus the region, then verify the input is focusable
  63  |     const fileInput = page.locator('#import-file-input')
  64  |     await fileInput.focus()
  65  |     const focused = await page.evaluate(() => document.activeElement?.id ?? '')
  66  |     expect(focused).toBe('import-file-input')
  67  |   })
  68  | })
  69  | 
  70  | test.describe('Import - IMP-01: Accepted file validation', () => {
  71  |   test('IMP-01 valid CSV file clears error and enables upload button', async ({ page }) => {
  72  |     await openImportPage(page)
  73  | 
  74  |     const fileInput = page.getByLabel(/file bancario/i)
  75  |     await fileInput.setInputFiles({
  76  |       name: 'statement.csv',
  77  |       mimeType: 'text/csv',
  78  |       buffer: Buffer.from('date,description,amount\n2024-01-01,Test,100.00'),
  79  |     })
  80  | 
  81  |     // No validation error alert visible
  82  |     await expect(page.locator('#import-file-error')).not.toBeVisible()
  83  |     // Upload button should no longer be disabled
  84  |     await expect(page.getByRole('button', { name: /carica file/i })).not.toBeDisabled()
  85  |   })
  86  | })
  87  | 
  88  | test.describe('Import - IMP-01: Upload retry integration', () => {
  89  |   test('IMP-01 retries transient presigned PUT failures and confirms only after upload success', async ({ page }) => {
  90  |     const fileId = '00000000-0000-4000-8000-000000000123'
  91  |     const presignedUrl = 'https://r2-upload.test/imports/statement.csv?signature=secret-signature'
  92  |     const putRequestOrder: number[] = []
  93  |     let confirmCalledAtPutAttempt: number | null = null
  94  | 
  95  |     await page.addInitScript(() => {
  96  |       window.addEventListener('upload-put-diagnostic', (event) => {
  97  |         const detail = event instanceof CustomEvent ? event.detail : null
  98  |         const current = (window as Window & { __uploadPutDiagnostics?: unknown[] }).__uploadPutDiagnostics ?? []
  99  |         ;(window as unknown as Window & { __uploadPutDiagnostics: unknown[] }).__uploadPutDiagnostics = [...current, detail]
  100 |       })
  101 |     })
  102 | 
  103 |     await page.route('**/api/files/initiate', async (route) => {
  104 |       expect(route.request().method()).toBe('POST')
  105 |       const body = route.request().postDataJSON() as { name: string; size: number; type: string }
  106 |       expect(body).toMatchObject({ name: 'statement.csv', type: 'text/csv' })
  107 |       expect(body.size).toBeGreaterThan(0)
  108 |       await route.fulfill({
  109 |         status: 200,
  110 |         contentType: 'application/json',
  111 |         body: JSON.stringify({
  112 |           file: {
  113 |             id: fileId,
  114 |             originalName: body.name,
  115 |             status: 'pending',
  116 |             sizeBytes: body.size,
  117 |             mimeType: body.type,
  118 |           },
  119 |           upload: {
  120 |             method: 'PUT',
  121 |             url: presignedUrl,
  122 |             expiresIn: 900,
  123 |             headers: { 'Content-Type': body.type },
  124 |           },
  125 |         }),
  126 |       })
  127 |     })
  128 | 
  129 |     await page.route('https://r2-upload.test/imports/statement.csv**', async (route) => {
  130 |       const request = route.request()
  131 |       if (request.method() === 'OPTIONS') {
  132 |         expect(request.headers()['access-control-request-headers'] ?? '').not.toContain('content-length')
  133 |         await route.fulfill({
  134 |           status: 204,
  135 |           headers: {
  136 |             'access-control-allow-origin': '*',
  137 |             'access-control-allow-methods': 'PUT, OPTIONS',
  138 |             'access-control-allow-headers': 'content-type',
  139 |           },
  140 |         })
  141 |         return
  142 |       }
```