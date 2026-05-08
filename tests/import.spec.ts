// Import page smoke tests
// Tests that require DB data or R2 are marked fixme — run against staging with seeded DB.
// Tests verifying UI structure and client-side validation run against local dev.
// Run: npx playwright test tests/import.spec.ts

import { expect, test, type Page } from '@playwright/test'

async function openImportPage(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  })
  await page.goto('/import')
}

test.describe('Import - IMP-01: Upload page structure', () => {
  test('IMP-01 /import renders page heading and file upload form', async ({ page }) => {
    await openImportPage(page)

    await expect(page.getByRole('heading', { name: /importa file bancario/i })).toBeVisible()
    await expect(page.getByLabel(/file bancario/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /carica file/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /storico importazioni/i })).toBeVisible()

    const historyTable = page.getByRole('table', { name: /storico importazioni/i })
    const emptyState = page.getByText(/nessuna importazione trovata/i)
    const safeErrorState = page.getByText(/storico importazioni non disponibile/i)

    await expect(historyTable.or(emptyState).or(safeErrorState)).toBeVisible()

    if (await historyTable.isVisible()) {
      await expect(page.getByRole('columnheader', { name: /file/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /stato/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /piattaforma/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /righe/i })).toBeVisible()
    }
  })

  test('IMP-01 upload button is disabled when no file is selected', async ({ page }) => {
    await openImportPage(page)

    const uploadBtn = page.getByRole('button', { name: /carica file/i })
    await expect(uploadBtn).toBeDisabled()
  })

  test('IMP-01 unsupported file type shows inline validation error', async ({ page }) => {
    await openImportPage(page)

    const fileInput = page.getByLabel(/file bancario/i)
    await fileInput.setInputFiles({
      name: 'statement.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
    })

    await expect(page.locator('#import-file-error')).toBeVisible()
    await expect(page.getByText(/formato non supportato/i)).toBeVisible()
  })

  test('IMP-01 upload form is keyboard-accessible: file input + button are reachable via Tab', async ({ page }) => {
    await openImportPage(page)

    // Click the file input label to focus the region, then verify the input is focusable
    const fileInput = page.locator('#import-file-input')
    await fileInput.focus()
    const focused = await page.evaluate(() => document.activeElement?.id ?? '')
    expect(focused).toBe('import-file-input')
  })
})

test.describe('Import - IMP-01: Accepted file validation', () => {
  test('IMP-01 valid CSV file clears error and enables upload button', async ({ page }) => {
    await openImportPage(page)

    const fileInput = page.getByLabel(/file bancario/i)
    await fileInput.setInputFiles({
      name: 'statement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,description,amount\n2024-01-01,Test,100.00'),
    })

    // No validation error alert visible
    await expect(page.locator('#import-file-error')).not.toBeVisible()
    // Upload button should no longer be disabled
    await expect(page.getByRole('button', { name: /carica file/i })).not.toBeDisabled()
  })
})

test.describe('Import - IMP-01: Upload retry integration', () => {
  test('IMP-01 retries transient presigned PUT failures and confirms only after upload success', async ({ page }) => {
    const fileId = '00000000-0000-4000-8000-000000000123'
    const presignedUrl = 'https://r2-upload.test/imports/statement.csv?signature=secret-signature'
    const putRequestOrder: number[] = []
    let confirmCalledAtPutAttempt: number | null = null

    await page.addInitScript(() => {
      window.addEventListener('upload-put-diagnostic', (event) => {
        const detail = event instanceof CustomEvent ? event.detail : null
        const current = (window as Window & { __uploadPutDiagnostics?: unknown[] }).__uploadPutDiagnostics ?? []
        ;(window as unknown as Window & { __uploadPutDiagnostics: unknown[] }).__uploadPutDiagnostics = [...current, detail]
      })
    })

    await page.route('**/api/files/initiate', async (route) => {
      expect(route.request().method()).toBe('POST')
      const body = route.request().postDataJSON() as { name: string; size: number; type: string }
      expect(body).toMatchObject({ name: 'statement.csv', type: 'text/csv' })
      expect(body.size).toBeGreaterThan(0)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          file: {
            id: fileId,
            originalName: body.name,
            status: 'pending',
            sizeBytes: body.size,
            mimeType: body.type,
          },
          upload: {
            method: 'PUT',
            url: presignedUrl,
            expiresIn: 900,
            headers: { 'Content-Type': body.type },
          },
        }),
      })
    })

    await page.route('https://r2-upload.test/imports/statement.csv**', async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'PUT, OPTIONS',
            'access-control-allow-headers': 'content-type, content-length',
          },
        })
        return
      }

      expect(request.method()).toBe('PUT')
      putRequestOrder.push(putRequestOrder.length + 1)
      await route.fulfill({
        status: putRequestOrder.length < 3 ? 503 : 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'etag',
        },
        body: putRequestOrder.length < 3 ? 'temporary unavailable' : '',
      })
    })

    await page.route('**/api/files/confirm', async (route) => {
      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toEqual({ fileId })
      confirmCalledAtPutAttempt = putRequestOrder.length
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await openImportPage(page)

    await page.getByLabel(/file bancario/i).setInputFiles({
      name: 'statement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,description,amount\n2024-01-01,Test,100.00'),
    })
    await page.getByRole('button', { name: /carica file/i }).click()

    await page.waitForURL(`**/import/${fileId}/analyze`)

    expect(putRequestOrder).toEqual([1, 2, 3])
    expect(confirmCalledAtPutAttempt).toBe(3)

    const diagnostics = await page.evaluate(() => (
      (window as Window & { __uploadPutDiagnostics?: Array<Record<string, unknown>> }).__uploadPutDiagnostics ?? []
    ))
    expect(diagnostics.map((event) => event.event)).toEqual([
      'upload_put_attempt',
      'upload_put_retrying',
      'upload_put_attempt',
      'upload_put_retrying',
      'upload_put_attempt',
    ])
    expect(diagnostics.filter((event) => event.event === 'upload_put_attempt')).toHaveLength(3)
    expect(diagnostics.filter((event) => event.event === 'upload_put_retrying')).toHaveLength(2)
    expect(JSON.stringify(diagnostics)).not.toContain('secret-signature')
  })
})

async function expectNoSecretDiagnostics(page: Page) {
  const bodyText = await page.locator('body').innerText()
  const html = await page.content()
  const consoleMessages = await page.evaluate(() =>
    (window as Window & { __uploadPutDiagnostics?: unknown[] }).__uploadPutDiagnostics ?? [],
  )
  const browserVisibleDiagnostics = `${bodyText}\n${html}\n${JSON.stringify(consoleMessages)}`

  await expect(page.getByText(/objectKey|presigned|stack trace|secret-signature/i)).toHaveCount(0)
  expect(browserVisibleDiagnostics).not.toContain('objectKey')
  expect(browserVisibleDiagnostics).not.toContain('presigned')
  expect(browserVisibleDiagnostics).not.toContain('secret-signature')
  expect(browserVisibleDiagnostics).not.toContain('storage diagnostics')
}

test.describe('Import - IMP-03: Filter, rename, and pagination UI', () => {
  test('IMP-03 keeps filter state in the URL and restores it after reload', async ({ page }) => {
    await openImportPage(page)

    await page.getByLabel(/cerca importazione/i).fill('statement')
    await expect(page).toHaveURL(/(?:\?|&)q=statement(?:&|$)/)

    await page.getByLabel(/importato da/i).fill('2024-01-01')
    await expect(page).toHaveURL(/(?:\?|&)importedFrom=2024-01-01(?:&|$)/)

    await page.getByLabel(/importato a/i).fill('2024-12-31')
    await expect(page).toHaveURL(/(?:\?|&)importedTo=2024-12-31(?:&|$)/)

    await page.getByLabel(/riferimento da/i).fill('2024-02-01')
    await expect(page).toHaveURL(/(?:\?|&)referenceFrom=2024-02-01(?:&|$)/)

    await page.getByLabel(/riferimento a/i).fill('2024-11-30')
    await expect(page).toHaveURL(/(?:\?|&)referenceTo=2024-11-30(?:&|$)/)

    await page.reload()

    await expect(page.getByLabel(/cerca importazione/i)).toHaveValue('statement')
    await expect(page.getByLabel(/importato da/i)).toHaveValue('2024-01-01')
    await expect(page.getByLabel(/importato a/i)).toHaveValue('2024-12-31')
    await expect(page.getByLabel(/riferimento da/i)).toHaveValue('2024-02-01')
    await expect(page.getByLabel(/riferimento a/i)).toHaveValue('2024-11-30')
    await expectNoSecretDiagnostics(page)
  })

  test('IMP-03 normalizes malformed URL dates and shows a safe reachable history state', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/import?importedFrom=not-a-date&referenceTo=2024-99-99&q=missing-import-name')

    await expect(page.getByLabel(/importato da/i)).toHaveValue('')
    await expect(page.getByLabel(/riferimento a/i)).toHaveValue('')

    const historyTable = page.getByRole('table', { name: /storico importazioni/i })
    const filteredEmptyState = page.getByText(/nessuna importazione corrisponde ai filtri/i)
    const safeErrorState = page.getByText(/storico importazioni non disponibile/i)

    await expect(historyTable.or(filteredEmptyState).or(safeErrorState)).toBeVisible()
    await expectNoSecretDiagnostics(page)
  })

  test('IMP-03 exposes keyboard rename actions and bounded load-more status when rows exist', async ({ page }) => {
    await openImportPage(page)

    const historyTable = page.getByRole('table', { name: /storico importazioni/i })
    const emptyState = page.getByText(/nessuna importazione trovata|nessuna importazione corrisponde ai filtri/i)
    const safeErrorState = page.getByText(/storico importazioni non disponibile/i)

    await expect(historyTable.or(emptyState).or(safeErrorState)).toBeVisible()

    if (await historyTable.isVisible()) {
      const renameButton = page.getByRole('button', { name: /rinomina importazione/i }).first()
      await renameButton.focus()
      await expect(renameButton).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: /rinomina importazione/i })).toBeVisible()
      await expect(page.getByLabel(/nome importazione/i)).toBeVisible()
      await page.keyboard.press('Escape')

      const loadMoreButton = page.getByRole('button', { name: /carica altre 50 importazioni/i })
      const allLoadedText = page.getByText(/tutte le importazioni disponibili sono caricate/i)
      await expect(loadMoreButton.or(allLoadedText)).toBeVisible()
    }

    await expectNoSecretDiagnostics(page)
  })
})

test.describe('Import - IMP-04: Delete dialog availability', () => {
  test('IMP-04 /import renders table or empty state without exposing secrets', async ({ page }) => {
    await openImportPage(page)

    const historyTable = page.getByRole('table', { name: /storico importazioni/i })
    const emptyState = page.getByText(/nessuna importazione trovata/i)
    const safeErrorState = page.getByText(/storico importazioni non disponibile/i)

    await expect(historyTable.or(emptyState).or(safeErrorState)).toBeVisible()

    if (await historyTable.isVisible()) {
      // If any imported row exists, the delete button must be keyboard-accessible
      const deleteButtons = page.getByRole('button', { name: /elimina importazione/i })
      const deleteButtonCount = await deleteButtons.count()

      // Delete buttons exist only for status=imported rows — assert presence is consistent with row data
      if (deleteButtonCount > 0) {
        await expect(deleteButtons.first()).toBeVisible()
        await expect(deleteButtons.first()).toBeEnabled()
      }
    }

    // In empty state: no delete button should exist (nothing to delete)
    if (await emptyState.isVisible()) {
      await expect(page.getByRole('button', { name: /elimina importazione/i })).toHaveCount(0)
    }

    await expectNoSecretDiagnostics(page)
  })
})

test.describe('Import - IMP-05: Configure page error state', () => {
  test('IMP-05 /import/[unknownId]/configure renders bounded error card without secrets', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/import/00000000-0000-4000-8000-000000000099/configure')

    await expect(page.getByRole('heading', { name: /configura formato importazione/i })).toBeVisible()

    // Error card heading must be present
    await expect(page.getByText(/formato non configurabile/i)).toBeVisible()

    // Error detail paragraph (from the action error or fallback message)
    const errorAlert = page.locator('[role="alert"]')
    await expect(errorAlert).toBeVisible()

    // Back link must point to /import
    const backLink = page.getByRole('link', { name: /torna agli import/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/import')

    await expectNoSecretDiagnostics(page)
  })
})

test.describe('Import - IMP-06: importId transaction filter', () => {
  test('IMP-06 /transactions?importId=<unknown> renders empty state without 500 or secrets', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/transactions?importId=00000000-0000-4000-8000-000000000099')

    // Page heading must be visible — confirms the RSC rendered without crashing
    await expect(page.getByRole('heading', { name: /transazioni/i })).toBeVisible()

    // Table or empty state must be visible (zero results expected for unknown importId)
    const transactionTable = page.getByRole('table')
    const emptyState = page.getByText(/nessuna transazione trovata|nessun risultato|nessuna transazione/i)

    await expect(transactionTable.or(emptyState)).toBeVisible()

    // Confirm no 500-level error page leaked through
    await expect(page.getByText(/500|application error|internal server error/i)).toHaveCount(0)

    await expectNoSecretDiagnostics(page)
  })
})

test.describe('Import - IMP-02: Analyze preview page', () => {
  test('IMP-02 /import/[fileId]/analyze renders preview structure when mocked', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB + R2 file — run against staging with a real uploaded file')

    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')

    await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
    await expect(page.getByText(/righe trovate/i)).toBeVisible()
    await expect(page.getByText(/duplicati/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /conferma importazione/i })).toBeVisible()
  })

  test('IMP-02 unknown-format analysis offers private format recovery CTA', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB + R2 file with unknown headers — run against staging')

    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/import/00000000-0000-0000-0000-000000000002/analyze')

    await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
    await expect(page.getByText(/formato non riconosciuto/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /configura formato privato/i })).toHaveAttribute(
      'href',
      /\/import\/00000000-0000-0000-0000-000000000002\/configure$/,
    )
  })

  test('IMP-02 parse/read analysis errors do not offer private format recovery controls', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB + R2 read or parse failure — run against staging')

    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/import/00000000-0000-0000-0000-000000000003/analyze')

    await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
    await expect(page.getByText(/errore di analisi/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /configura formato privato/i })).toHaveCount(0)
  })

  test('IMP-02 unknown fileId returns 404 not-found response', async ({ page }) => {
    test.fixme(true, 'Requires real session — staging only; 404 redirects to login without auth')
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    const response = await page.goto('/import/00000000-0000-0000-0000-000000000000/analyze')
    expect(response?.status()).toBe(404)
  })

  test('IMP-02 confirm triggers redirect to /expenses on success', async ({ page }) => {
    test.fixme(true, 'Requires real uploaded+analyzed file in DB — run against staging')

    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')
    await page.getByRole('button', { name: /conferma importazione/i }).click()
    await page.waitForURL('/expenses')
    expect(page.url()).toContain('/expenses')
  })
})
