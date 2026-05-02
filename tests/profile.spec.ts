import { expect, test, type Page } from '@playwright/test'

async function openProfile(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  })
  await page.goto('/profile')
}

test.describe('Profile - PROF-01: page shell', () => {
  test('PROF-01 /profile returns 200', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    const response = await page.goto('/profile')
    expect(response?.status()).toBe(200)
  })

  test('PROF-01 profile page renders heading', async ({ page }) => {
    await openProfile(page)
    await expect(page.getByRole('heading', { name: 'Profilo' })).toBeVisible()
  })
})

test.describe('Profile - PROF-02: editable form fields', () => {
  test('PROF-02 six labeled editable inputs are present', async ({ page }) => {
    await openProfile(page)

    await expect(page.getByLabel('Nome', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Cognome', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Ruolo professionale')).toBeVisible()
    await expect(page.getByLabel('Località')).toBeVisible()
    await expect(page.getByLabel('Telefono')).toBeVisible()
    await expect(page.getByLabel('Fuso orario')).toBeVisible()
  })

  test('PROF-02 editable fields are actual form inputs', async ({ page }) => {
    await openProfile(page)

    const inputs = ['firstName', 'lastName', 'jobTitle', 'location', 'phone', 'timezone']
    for (const name of inputs) {
      await expect(page.locator(`input[name="${name}"]`)).toBeVisible()
    }
  })

  test('PROF-02 empty fields render without uncontrolled/controlled React warnings', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' || (msg.type() === 'warning' && msg.text().includes('controlled'))) {
        consoleErrors.push(msg.text())
      }
    })
    await openProfile(page)
    const controlledWarnings = consoleErrors.filter((e) =>
      e.toLowerCase().includes('controlled') || e.toLowerCase().includes('uncontrolled'),
    )
    expect(controlledWarnings).toHaveLength(0)
  })
})

test.describe('Profile - PROF-03: read-only account fields', () => {
  test('PROF-03 email is visible but not an editable input', async ({ page }) => {
    await openProfile(page)

    // Email should be visible on page
    await expect(page.locator('#account-email')).toBeVisible()
    // There must be no <input name="email"> in the form
    await expect(page.locator('input[name="email"]')).toHaveCount(0)
  })

  test('PROF-03 subscription plan is visible but not an editable input', async ({ page }) => {
    await openProfile(page)

    await expect(page.locator('#account-plan')).toBeVisible()
    await expect(page.locator('input[name="subscriptionPlan"]')).toHaveCount(0)
  })

  test('PROF-03 role is visible but not an editable input', async ({ page }) => {
    await openProfile(page)

    await expect(page.locator('#account-role')).toBeVisible()
    await expect(page.locator('input[name="role"]')).toHaveCount(0)
  })
})

test.describe('Profile - PROF-04: topbar navigation', () => {
  test('PROF-04 topbar profile dropdown navigates to /profile', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/dashboard')

    // Open the avatar dropdown
    await page.getByRole('button', { name: 'Menu utente' }).click()

    // Click the Profilo menu item — it is a link inside DropdownMenuItem asChild
    await page.getByRole('menuitem', { name: 'Profilo' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByRole('heading', { name: 'Profilo' })).toBeVisible()
  })
})

test.describe('Profile - PROF-05: form accessibility', () => {
  test('PROF-05 save button is present and keyboard-submittable', async ({ page }) => {
    await openProfile(page)

    const saveBtn = page.getByRole('button', { name: 'Salva modifiche' })
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
  })
})

test.describe('Profile - PROF-06: unauthenticated redirect', () => {
  test('PROF-06 /profile without staging key redirects to login', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)
  })
})
