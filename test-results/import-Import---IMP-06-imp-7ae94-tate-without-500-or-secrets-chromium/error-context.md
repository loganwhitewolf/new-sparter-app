# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: import.spec.ts >> Import - IMP-06: importId transaction filter >> IMP-06 /transactions?importId=<unknown> renders empty state without 500 or secrets
- Location: tests/import.spec.ts:352:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Transazioni' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Transazioni' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [active]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - navigation [ref=e7]:
            - button "previous" [disabled] [ref=e8]:
              - img "previous" [ref=e9]
            - generic [ref=e11]:
              - generic [ref=e12]: 1/
              - text: "2"
            - button "next" [ref=e13] [cursor=pointer]:
              - img "next" [ref=e14]
          - img
        - generic [ref=e16]:
          - link "Next.js 16.2.4 (stale) Turbopack" [ref=e17] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
            - img [ref=e18]
            - generic "There is a newer version (16.2.6) available, upgrade recommended!" [ref=e20]: Next.js 16.2.4 (stale)
            - generic [ref=e21]: Turbopack
          - img
      - generic [ref=e22]:
        - dialog "Console Error" [ref=e23]:
          - generic [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e28]:
                - generic [ref=e30]: Console Error
                - generic [ref=e31]:
                  - button "Copy Error Info" [ref=e32] [cursor=pointer]:
                    - img [ref=e33]
                  - button "No related documentation found" [disabled] [ref=e35]:
                    - img [ref=e36]
                  - button "Attach Node.js inspector" [ref=e38] [cursor=pointer]:
                    - img [ref=e39]
              - generic [ref=e48]:
                - text: Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead (
                - link "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template" [ref=e49] [cursor=pointer]:
                  - /url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template
                - text: ).
            - generic [ref=e50]:
              - generic [ref=e51]:
                - paragraph [ref=e53]:
                  - img [ref=e55]
                  - generic [ref=e58]: components/theme-provider.tsx (7:10) @ ThemeProvider
                  - button "Open in editor" [ref=e59] [cursor=pointer]:
                    - img [ref=e61]
                - generic [ref=e64]:
                  - generic [ref=e65]: 5 |
                  - generic [ref=e66]: "6 | export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {"
                  - generic [ref=e67]: "> 7 | return <NextThemesProvider {...props}>{children}</NextThemesProvider>"
                  - generic [ref=e68]: "| ^"
                  - generic [ref=e69]: "8 | }"
                  - generic [ref=e70]: 9 |
              - generic [ref=e71]:
                - generic [ref=e72]:
                  - paragraph [ref=e73]:
                    - text: Call Stack
                    - generic [ref=e74]: "18"
                  - button "Show 15 ignore-listed frame(s)" [ref=e75] [cursor=pointer]:
                    - text: Show 15 ignore-listed frame(s)
                    - img [ref=e76]
                - generic [ref=e78]:
                  - generic [ref=e79]: script
                  - text: <anonymous>
                - generic [ref=e80]:
                  - generic [ref=e81]:
                    - text: ThemeProvider
                    - button "Open ThemeProvider in editor" [ref=e82] [cursor=pointer]:
                      - img [ref=e83]
                  - text: components/theme-provider.tsx (7:10)
                - generic [ref=e85]:
                  - generic [ref=e86]:
                    - text: RootLayout
                    - button "Open RootLayout in editor" [ref=e87] [cursor=pointer]:
                      - img [ref=e88]
                  - text: app/layout.tsx (20:9)
          - generic [ref=e90]: "1"
          - generic [ref=e91]: "2"
        - contentinfo [ref=e92]:
          - region "Error feedback" [ref=e93]:
            - paragraph [ref=e94]:
              - link "Was this helpful?" [ref=e95] [cursor=pointer]:
                - /url: https://nextjs.org/telemetry#error-feedback
            - button "Mark as helpful" [ref=e96] [cursor=pointer]:
              - img [ref=e97]
            - button "Mark as not helpful" [ref=e100] [cursor=pointer]:
              - img [ref=e101]
    - generic [ref=e107] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e108]:
        - img [ref=e109]
      - generic [ref=e112]:
        - button "Open issues overlay" [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e115]: "1"
            - generic [ref=e116]: "2"
          - generic [ref=e117]:
            - text: Issue
            - generic [ref=e118]: s
        - button "Collapse issues badge" [ref=e119]:
          - img [ref=e120]
  - generic [ref=e123]:
    - img [ref=e124]
    - heading "This page couldn’t load" [level=1] [ref=e126]
    - paragraph [ref=e127]: A server error occurred. Reload to try again.
    - button "Reload" [ref=e130] [cursor=pointer]
  - paragraph [ref=e131]: ERROR 3936760258
```

# Test source

```ts
  259 | 
  260 |     const historyTable = page.getByRole('table', { name: /storico importazioni/i })
  261 |     const filteredEmptyState = page.getByText(/nessuna importazione corrisponde ai filtri/i)
  262 |     const safeErrorState = page.getByText(/storico importazioni non disponibile/i)
  263 | 
  264 |     await expect(historyTable.or(filteredEmptyState).or(safeErrorState)).toBeVisible()
  265 |     await expectNoSecretDiagnostics(page)
  266 |   })
  267 | 
  268 |   test('IMP-03 exposes keyboard rename actions and bounded load-more status when rows exist', async ({ page }) => {
  269 |     await openImportPage(page)
  270 | 
  271 |     const historyTable = page.getByRole('table', { name: /storico importazioni/i })
  272 |     const emptyState = page.getByText(/nessuna importazione trovata|nessuna importazione corrisponde ai filtri/i)
  273 |     const safeErrorState = page.getByText(/storico importazioni non disponibile/i)
  274 | 
  275 |     await expect(historyTable.or(emptyState).or(safeErrorState)).toBeVisible()
  276 | 
  277 |     if (await historyTable.isVisible()) {
  278 |       const renameButton = page.getByRole('button', { name: /rinomina importazione/i }).first()
  279 |       await renameButton.focus()
  280 |       await expect(renameButton).toBeFocused()
  281 |       await page.keyboard.press('Enter')
  282 |       await expect(page.getByRole('dialog', { name: /rinomina importazione/i })).toBeVisible()
  283 |       await expect(page.getByLabel(/nome importazione/i)).toBeVisible()
  284 |       await page.keyboard.press('Escape')
  285 | 
  286 |       const loadMoreButton = page.getByRole('button', { name: /carica altre 50 importazioni/i })
  287 |       const allLoadedText = page.getByText(/tutte le importazioni disponibili sono caricate/i)
  288 |       await expect(loadMoreButton.or(allLoadedText)).toBeVisible()
  289 |     }
  290 | 
  291 |     await expectNoSecretDiagnostics(page)
  292 |   })
  293 | })
  294 | 
  295 | test.describe('Import - IMP-04: Delete dialog availability', () => {
  296 |   test('IMP-04 /import renders table or empty state without exposing secrets', async ({ page }) => {
  297 |     await openImportPage(page)
  298 | 
  299 |     const historyTable = page.getByRole('table', { name: /storico importazioni/i })
  300 |     const emptyState = page.getByText(/nessuna importazione trovata/i)
  301 |     const safeErrorState = page.getByText(/storico importazioni non disponibile/i)
  302 | 
  303 |     await expect(historyTable.or(emptyState).or(safeErrorState)).toBeVisible()
  304 | 
  305 |     if (await historyTable.isVisible()) {
  306 |       // If any imported row exists, the delete button must be keyboard-accessible
  307 |       const deleteButtons = page.getByRole('button', { name: /elimina importazione/i })
  308 |       const deleteButtonCount = await deleteButtons.count()
  309 | 
  310 |       // Delete buttons exist only for status=imported rows — assert presence is consistent with row data
  311 |       if (deleteButtonCount > 0) {
  312 |         await expect(deleteButtons.first()).toBeVisible()
  313 |         await expect(deleteButtons.first()).toBeEnabled()
  314 |       }
  315 |     }
  316 | 
  317 |     // In empty state: no delete button should exist (nothing to delete)
  318 |     if (await emptyState.isVisible()) {
  319 |       await expect(page.getByRole('button', { name: /elimina importazione/i })).toHaveCount(0)
  320 |     }
  321 | 
  322 |     await expectNoSecretDiagnostics(page)
  323 |   })
  324 | })
  325 | 
  326 | test.describe('Import - IMP-05: Configure page error state', () => {
  327 |   test('IMP-05 /import/[unknownId]/configure renders bounded error card without secrets', async ({ page }) => {
  328 |     await page.setExtraHTTPHeaders({
  329 |       'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  330 |     })
  331 |     await page.goto('/import/00000000-0000-4000-8000-000000000099/configure')
  332 | 
  333 |     await expect(page.getByRole('heading', { name: /configura formato importazione/i })).toBeVisible()
  334 | 
  335 |     // Error card heading must be present
  336 |     await expect(page.getByText(/formato non configurabile/i)).toBeVisible()
  337 | 
  338 |     // Error detail paragraph (from the action error or fallback message)
  339 |     const errorAlert = page.locator('[role="alert"]')
  340 |     await expect(errorAlert).toBeVisible()
  341 | 
  342 |     // Back link must point to /import
  343 |     const backLink = page.getByRole('link', { name: /torna alle importazioni/i })
  344 |     await expect(backLink).toBeVisible()
  345 |     await expect(backLink).toHaveAttribute('href', '/import')
  346 | 
  347 |     await expectNoSecretDiagnostics(page)
  348 |   })
  349 | })
  350 | 
  351 | test.describe('Import - IMP-06: importId transaction filter', () => {
  352 |   test('IMP-06 /transactions?importId=<unknown> renders empty state without 500 or secrets', async ({ page }) => {
  353 |     await page.setExtraHTTPHeaders({
  354 |       'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  355 |     })
  356 |     await page.goto('/transactions?importId=00000000-0000-4000-8000-000000000099')
  357 | 
  358 |     // Page heading must be visible — confirms the RSC rendered without crashing
> 359 |     await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  360 | 
  361 |     // Table or empty state must be visible (zero results expected for unknown importId)
  362 |     const transactionTable = page.getByRole('table')
  363 |     const emptyState = page.getByText(/nessuna transazione trovata|nessun risultato|nessuna transazione/i)
  364 | 
  365 |     await expect(transactionTable.or(emptyState)).toBeVisible()
  366 | 
  367 |     // Confirm no 500-level error page leaked through
  368 |     await expect(page.getByText(/500|application error|internal server error/i)).toHaveCount(0)
  369 | 
  370 |     await expectNoSecretDiagnostics(page)
  371 |   })
  372 | })
  373 | 
  374 | test.describe('Import - IMP-02: Analyze preview page', () => {
  375 |   test('IMP-02 /import/[fileId]/analyze renders preview structure when mocked', async ({ page }) => {
  376 |     test.fixme(true, 'Requires seeded DB + R2 file — run against staging with a real uploaded file')
  377 | 
  378 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  379 |     await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')
  380 | 
  381 |     await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
  382 |     await expect(page.getByText(/righe trovate/i)).toBeVisible()
  383 |     await expect(page.getByText(/duplicati/i)).toBeVisible()
  384 |     await expect(page.getByRole('button', { name: /conferma importazione/i })).toBeVisible()
  385 |   })
  386 | 
  387 |   test('IMP-02 unknown-format analysis offers private format recovery CTA', async ({ page }) => {
  388 |     test.fixme(true, 'Requires seeded DB + R2 file with unknown headers — run against staging')
  389 | 
  390 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  391 |     await page.goto('/import/00000000-0000-0000-0000-000000000002/analyze')
  392 | 
  393 |     await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
  394 |     await expect(page.getByText(/formato non riconosciuto/i)).toBeVisible()
  395 |     await expect(page.getByRole('link', { name: /configura formato privato/i })).toHaveAttribute(
  396 |       'href',
  397 |       /\/import\/00000000-0000-0000-0000-000000000002\/configure$/,
  398 |     )
  399 |   })
  400 | 
  401 |   test('IMP-02 parse/read analysis errors do not offer private format recovery controls', async ({ page }) => {
  402 |     test.fixme(true, 'Requires seeded DB + R2 read or parse failure — run against staging')
  403 | 
  404 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  405 |     await page.goto('/import/00000000-0000-0000-0000-000000000003/analyze')
  406 | 
  407 |     await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
  408 |     await expect(page.getByText(/errore di analisi/i)).toBeVisible()
  409 |     await expect(page.getByRole('link', { name: /configura formato privato/i })).toHaveCount(0)
  410 |   })
  411 | 
  412 |   test('IMP-02 unknown fileId returns 404 not-found response', async ({ page }) => {
  413 |     test.fixme(true, 'Requires real session — staging only; 404 redirects to login without auth')
  414 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  415 |     const response = await page.goto('/import/00000000-0000-0000-0000-000000000000/analyze')
  416 |     expect(response?.status()).toBe(404)
  417 |   })
  418 | 
  419 |   test('IMP-02 confirm triggers redirect to /expenses on success', async ({ page }) => {
  420 |     test.fixme(true, 'Requires real uploaded+analyzed file in DB — run against staging')
  421 | 
  422 |     await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
  423 |     await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')
  424 |     await page.getByRole('button', { name: /conferma importazione/i }).click()
  425 |     await page.waitForURL('/expenses')
  426 |     expect(page.url()).toContain('/expenses')
  427 |   })
  428 | })
  429 | 
```