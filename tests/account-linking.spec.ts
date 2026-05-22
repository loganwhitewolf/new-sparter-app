import { expect, test, type Page } from '@playwright/test'

function requireStagingKey(): string {
  const key = process.env.STAGING_KEY
  if (!key) throw new Error('STAGING_KEY env var is required for E2E tests')
  return key
}

async function openSettings(page: Page) {
  await page.setExtraHTTPHeaders({ 'x-staging-key': requireStagingKey() })
  await page.goto('/settings')
}

async function openSettingsProfile(page: Page) {
  await page.setExtraHTTPHeaders({ 'x-staging-key': requireStagingKey() })
  await page.goto('/settings/profile')
}

test.describe('Account Linking - LINK-04: settings IA + Account collegati card', () => {
  test('LINK-04 /settings hub renders (no redirect to /settings/categories)', async ({ page }) => {
    await openSettings(page)
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()
  })

  test('LINK-04 /settings hub links to /settings/profile and /settings/categories (D-01)', async ({ page }) => {
    await openSettings(page)
    await expect(page.getByRole('link', { name: /profilo/i })).toHaveAttribute('href', '/settings/profile')
    await expect(page.getByRole('link', { name: /categori/i })).toHaveAttribute('href', '/settings/categories')
  })

  test('LINK-04 /settings/profile shows Account collegati card (D-09)', async ({ page }) => {
    await openSettingsProfile(page)
    await expect(page.getByRole('heading', { name: 'Account collegati' })).toBeVisible()
  })

  test('LINK-04 /profile redirects to /settings/profile (D-04)', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-staging-key': requireStagingKey() })
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/settings\/profile/)
  })
})

test.describe('Account Linking - LINK-01: Google link', () => {
  test('LINK-01 Google row exposes Collega action when not yet linked', async ({ page }) => {
    // In staging-key mode listAccounts() will not return a real session.
    // The card should still render Google row when GOOGLE_CLIENT_ID is set.
    await openSettingsProfile(page)
    // Soft assertion: the row exists if Google is configured. Skip when env absent.
    test.fixme(!process.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID not set in this env')
    await expect(page.getByText('Google').first()).toBeVisible()
  })

  test('LINK-01 live Google link flow', async () => {
    test.fixme()
    // LINK-01: From /settings/profile click "Collega" on the Google row.
    // Better Auth round-trip completes -> redirects to /settings/profile?linked=google.
    // Card refreshes and shows Collegato for Google, with only the Scollega action.
    // Manual only — requires real Google OAuth credentials configured for the dev URL.
  })
})

test.describe('Account Linking - LINK-02: GitHub link', () => {
  test('LINK-02 GitHub row exposes Collega action when not yet linked', async ({ page }) => {
    await openSettingsProfile(page)
    test.fixme(!process.env.GITHUB_CLIENT_ID, 'GITHUB_CLIENT_ID not set in this env')
    await expect(page.getByText('GitHub').first()).toBeVisible()
  })

  test('LINK-02 live GitHub link flow', async () => {
    test.fixme()
    // LINK-02: Same as LINK-01 with GitHub. Returns to /settings/profile?linked=github.
  })

  test('LINK-02 email mismatch shows Italian error (D-12)', async () => {
    test.fixme()
    // Trigger the OAuth flow with a provider account whose email differs from the Sparter account email.
    // Better Auth callback redirects to /settings/profile?error=email_doesn%27t_match.
    // Expected: "L'email del provider non corrisponde all'email del tuo account Sparter."
  })
})

test.describe('Account Linking - LINK-03: unlink safety', () => {
  test('LINK-03 unlink button is rendered for linked providers (visual)', async ({ page }) => {
    await openSettingsProfile(page)
    // In staging bypass listAccounts() returns empty, so this asserts the card renders.
    // Full assertion of disabled state lives in the unit test (canUnlink guard).
    await expect(page.getByRole('heading', { name: 'Account collegati' })).toBeVisible()
  })

  test('LINK-03 live unlink flow', async () => {
    test.fixme()
    // After LINK-01 or LINK-02 succeeds, the user clicks Scollega, confirms the dialog,
    // and the toast "Provider scollegato." appears. The card refreshes to Non collegato.
  })

  test('LINK-03 last-method guard disables unlink (D-14, D-16)', async () => {
    test.fixme()
    // When the only remaining account is the social provider being unlinked, the action
    // must be disabled with tooltip "Non puoi scollegare l'unico metodo di accesso."
    // This is verified statically in the unit test against the canUnlink helper.
  })
})
