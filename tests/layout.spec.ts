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
})
