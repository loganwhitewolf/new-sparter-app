import { expect, test, type Page } from '@playwright/test'

async function openDashboard(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  })
  await page.goto('/dashboard')
}

test.describe('Dashboard - DASH-01: Overview KPI', () => {
  test('DASH-01 overview renders five KPI cards', async ({ page }) => {
    await openDashboard(page)

    await expect(page.getByText('Totale entrate')).toBeVisible()
    await expect(page.getByText('Totale uscite')).toBeVisible()
    await expect(page.getByText('Bilancio')).toBeVisible()
    await expect(page.getByText('Tasso risparmio')).toBeVisible()
    await expect(page.getByText('Da categorizzare')).toBeVisible()
  })

  test('DASH-01 mobile KPI grid has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openDashboard(page)

    const hasNoHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )

    expect(hasNoHorizontalOverflow).toBe(true)
  })
})

test.describe('Dashboard - DASH-02: Category breakdown', () => {
  test('DASH-02 tab links preserve preset and type URL filters', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/dashboard/overview?preset=last-3-months&type=in&page=2')

    await expect(page.getByRole('link', { name: 'Categorie' })).toHaveAttribute(
      'href',
      '/dashboard/categories?preset=last-3-months&type=in'
    )
    await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard/overview?preset=last-3-months&type=in'
    )
  })

  test('DASH-02 categories route exposes OUT/IN filters and accepts legacy period aliases', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/dashboard/categories?period=last-3-months&type=bogus')

    await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Uscite' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Entrate' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tutti' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Uscite' })).toHaveAttribute('data-state', 'active')
  })

  test('DASH-02 drill-down expands a category row', async ({ page }) => {
    test.fixme(true, 'Requires seeded categorized expenses')
    await openDashboard(page)
  })
})

test.describe('Dashboard - DASH-03: Monthly trend', () => {
  test('DASH-03 trend chart renders grouped series controls', async ({ page }) => {
    await openDashboard(page)

    await expect(page.getByText('Trend mensile')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrate' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Uscite' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Non categorizzato' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ignorato' })).toBeVisible()
  })

  test('DASH-03 legend click toggles a series', async ({ page }) => {
    test.fixme(true, 'Manual visual verification of SVG series visibility')
    await openDashboard(page)
  })
})
