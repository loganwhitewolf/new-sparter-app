# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: import.spec.ts >> Import - IMP-05: Configure page error state >> IMP-05 /import/[unknownId]/configure renders bounded error card without secrets
- Location: tests/import.spec.ts:327:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[role="alert"]')
Expected: visible
Error: strict mode violation: locator('[role="alert"]') resolved to 2 elements:
    1) <div role="alert" data-slot="alert" class="relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:translate-y-0.5 text-destructive bg-card [&>svg]:text-destructive *:data-[slot=alert-description]:text-destructive/80">…</div> aka getByRole('alert').filter({ hasText: 'Importazione non trovata o' })
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[role="alert"]')

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
          - button "Tema" [disabled]
          - button "Menu utente" [ref=e43]:
            - generic [ref=e45]: U
      - main [ref=e46]:
        - generic [ref=e47]:
          - generic [ref=e48]:
            - heading "Configura formato importazione" [level=1] [ref=e49]
            - paragraph [ref=e50]: Non è stato possibile preparare la configurazione del formato.
          - generic [ref=e51]:
            - generic [ref=e53]: Formato non configurabile
            - generic [ref=e54]:
              - alert [ref=e55]:
                - img [ref=e56]
                - generic [ref=e58]: Importazione non trovata o accesso negato.
              - link "Torna alle importazioni" [ref=e59] [cursor=pointer]:
                - /url: /import
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e65] [cursor=pointer]:
    - img [ref=e66]
  - alert [ref=e69]
```

# Test source

```ts
  240 | 
  241 |     await page.reload()
  242 | 
  243 |     await expect(page.getByLabel(/cerca importazione/i)).toHaveValue('statement')
  244 |     await expect(page.getByLabel(/importato da/i)).toHaveValue('2024-01-01')
  245 |     await expect(page.getByLabel(/importato a/i)).toHaveValue('2024-12-31')
  246 |     await expect(page.getByLabel(/riferimento da/i)).toHaveValue('2024-02-01')
  247 |     await expect(page.getByLabel(/riferimento a/i)).toHaveValue('2024-11-30')
  248 |     await expectNoSecretDiagnostics(page)
  249 |   })
  250 | 
  251 |   test('IMP-03 normalizes malformed URL dates and shows a safe reachable history state', async ({ page }) => {
  252 |     await page.setExtraHTTPHeaders({
  253 |       'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  254 |     })
  255 |     await page.goto('/import?importedFrom=not-a-date&referenceTo=2024-99-99&q=missing-import-name')
  256 | 
  257 |     await expect(page.getByLabel(/importato da/i)).toHaveValue('')
  258 |     await expect(page.getByLabel(/riferimento a/i)).toHaveValue('')
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
> 340 |     await expect(errorAlert).toBeVisible()
      |                              ^ Error: expect(locator).toBeVisible() failed
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
  359 |     await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
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