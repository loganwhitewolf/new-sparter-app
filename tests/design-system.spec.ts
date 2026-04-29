import { expect, test } from '@playwright/test'

test.describe('Design System - DS-01: CSS variables', () => {
  test('--primary CSS variable is defined in :root', async ({ page }) => {
    await page.goto('/login')

    const primaryValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim()
    )

    expect(primaryValue).not.toBe('')
    expect(primaryValue.length).toBeGreaterThan(0)
  })

  test('font-family contains Geist', async ({ page }) => {
    await page.goto('/login')

    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily
    )

    expect(fontFamily.toLowerCase()).toContain('geist')
  })

  test('--background CSS variable is defined', async ({ page }) => {
    await page.goto('/login')

    const backgroundValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim()
    )

    expect(backgroundValue).not.toBe('')
  })
})

test.describe('Design System - DS-02: shadcn components', () => {
  test('Button component renders at /login', async ({ page }) => {
    await page.goto('/login')

    const button = page.locator('button').first()
    await expect(button).toBeVisible()
  })
})
