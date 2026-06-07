import { expect, test } from '@playwright/test'

test.describe('Layout - DS-03: (auth) route group', () => {
  test('/login renders without sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/login')

    const sidebar = page.locator('[data-sidebar]')
    await expect(sidebar).not.toBeVisible()
  })

  test('/login returns 200', async ({ page }) => {
    const response = await page.goto('/login')
    expect(response?.status()).toBe(200)
  })
})

test.describe('Layout - DS-03: (app) route group', () => {
  test('/dashboard has sidebar visible on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    const sidebar = page.locator('[data-sidebar]')
    await expect(sidebar).toBeVisible()
  })

  test('/dashboard returns 200', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    const response = await page.goto('/dashboard')
    expect(response?.status()).toBe(200)
  })

  test('bottom nav is visible on mobile viewport (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    const bottomNav = page.locator('[data-bottom-nav]')
    await expect(bottomNav).toBeVisible()
  })

  test('bottom nav is hidden on desktop viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    const bottomNav = page.locator('[data-bottom-nav]')
    await expect(bottomNav).not.toBeVisible()
  })

  test('desktop sidebar has no visible /categories navigation link', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    const sidebar = page.locator('[data-sidebar]')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('a[href="/categories"]')).toHaveCount(0)
  })

  test('mobile bottom nav has no visible /categories navigation link', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    const bottomNav = page.locator('[data-bottom-nav]')
    await expect(bottomNav).toBeVisible()
    await expect(bottomNav.locator('a[href="/categories"]')).toHaveCount(0)
  })

  test('sidebar collapse persists to localStorage (D-05)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    // Sidebar visible and expanded by default (D-03)
    const sidebar = page.locator('[data-sidebar]')
    await expect(sidebar).toBeVisible()

    // Collapse the sidebar via toggle button
    await page.getByRole('button', { name: 'Comprimi barra laterale' }).click()

    // localStorage key set to 'true' after collapse (D-05)
    const stored = await page.evaluate(() => localStorage.getItem('sparter-sidebar-collapsed'))
    expect(stored).toBe('true')

    // Reload and verify collapsed state is restored (toggle label now 'Espandi barra laterale')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Espandi barra laterale' })).toBeVisible()
  })

  test('mobile bottom nav has an Impostazioni link to /settings (D-10)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })
    await page.goto('/dashboard')

    const bottomNav = page.locator('[data-bottom-nav]')
    await expect(bottomNav).toBeVisible()
    await expect(bottomNav.locator('a[href="/settings"]')).toHaveCount(1)
  })
})
