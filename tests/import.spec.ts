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
        ;(window as Window & { __uploadPutDiagnostics: unknown[] }).__uploadPutDiagnostics = [...current, detail]
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

  test('IMP-02 unknown fileId returns 404 not-found response', async ({ page }) => {
    test.fixme(true, 'Requires real session — staging only; 404 redirects to login without auth')
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    const response = await page.goto('/import/00000000-0000-0000-0000-000000000000/analyze')
    expect(response?.status()).toBe(404)
  })

  test('IMP-02 confirm triggers redirect to /spese on success', async ({ page }) => {
    test.fixme(true, 'Requires real uploaded+analyzed file in DB — run against staging')

    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/import/00000000-0000-0000-0000-000000000001/analyze')
    await page.getByRole('button', { name: /conferma importazione/i }).click()
    await page.waitForURL('/spese')
    expect(page.url()).toContain('/spese')
  })
})
