# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: import.spec.ts >> Import - IMP-01: Upload retry integration >> IMP-01 retries transient presigned PUT failures and confirms only after upload success
- Location: tests/import.spec.ts:75:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /carica file/i })
    - locator resolved to <button disabled aria-busy="false" data-slot="button" data-size="default" data-variant="default" aria-label="Carica file" class="inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer…>…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

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
  142 |       expect(route.request().method()).toBe('POST')
  143 |       expect(route.request().postDataJSON()).toEqual({ fileId })
  144 |       confirmCalledAtPutAttempt = putRequestOrder.length
  145 |       await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  146 |     })
  147 | 
  148 |     await openImportPage(page)
  149 | 
  150 |     await page.getByLabel(/file bancario/i).setInputFiles({
  151 |       name: 'statement.csv',
  152 |       mimeType: 'text/csv',
  153 |       buffer: Buffer.from('date,description,amount\n2024-01-01,Test,100.00'),
  154 |     })
> 155 |     await page.getByRole('button', { name: /carica file/i }).click()
      |                                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  156 | 
  157 |     await page.waitForURL(`**/import/${fileId}/analyze`)
  158 | 
  159 |     expect(putRequestOrder).toEqual([1, 2, 3])
  160 |     expect(confirmCalledAtPutAttempt).toBe(3)
  161 | 
  162 |     const diagnostics = await page.evaluate(() => (
  163 |       (window as Window & { __uploadPutDiagnostics?: Array<Record<string, unknown>> }).__uploadPutDiagnostics ?? []
  164 |     ))
  165 |     expect(diagnostics.map((event) => event.event)).toEqual([
  166 |       'upload_put_attempt',
  167 |       'upload_put_retrying',
  168 |       'upload_put_attempt',
  169 |       'upload_put_retrying',
  170 |       'upload_put_attempt',
  171 |     ])
  172 |     expect(diagnostics.filter((event) => event.event === 'upload_put_attempt')).toHaveLength(3)
  173 |     expect(diagnostics.filter((event) => event.event === 'upload_put_retrying')).toHaveLength(2)
  174 |     expect(JSON.stringify(diagnostics)).not.toContain('secret-signature')
  175 |   })
  176 | })
  177 | 
  178 | test.describe('Import - IMP-02: Analyze preview page', () => {
  179 |   test('IMP-02 /import/[fileId]/analyze renders preview structure when mocked', async ({ page }) => {
  180 |     test.fixme(true, 'Requires seeded DB + R2 file — run against staging with a real uploaded file')
  181 | 
  182 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  183 |     await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')
  184 | 
  185 |     await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
  186 |     await expect(page.getByText(/righe trovate/i)).toBeVisible()
  187 |     await expect(page.getByText(/duplicati/i)).toBeVisible()
  188 |     await expect(page.getByRole('button', { name: /conferma importazione/i })).toBeVisible()
  189 |   })
  190 | 
  191 |   test('IMP-02 unknown fileId returns 404 not-found response', async ({ page }) => {
  192 |     test.fixme(true, 'Requires real session — staging only; 404 redirects to login without auth')
  193 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  194 |     const response = await page.goto('/import/00000000-0000-0000-0000-000000000000/analyze')
  195 |     expect(response?.status()).toBe(404)
  196 |   })
  197 | 
  198 |   test('IMP-02 confirm triggers redirect to /expenses on success', async ({ page }) => {
  199 |     test.fixme(true, 'Requires real uploaded+analyzed file in DB — run against staging')
  200 | 
  201 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  202 |     await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')
  203 |     await page.getByRole('button', { name: /conferma importazione/i }).click()
  204 |     await page.waitForURL('/expenses')
  205 |     expect(page.url()).toContain('/expenses')
  206 |   })
  207 | })
  208 | 
```