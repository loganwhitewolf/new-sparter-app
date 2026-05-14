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

    await expect(page.getByTestId('kpi-totale-entrate')).toBeVisible()
    await expect(page.getByTestId('kpi-totale-uscite')).toBeVisible()
    await expect(page.getByTestId('kpi-bilancio')).toBeVisible()
    await expect(page.getByTestId('kpi-tasso-risparmio')).toBeVisible()
    await expect(page.getByTestId('kpi-da-categorizzare')).toBeVisible()
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
    await page.goto('/dashboard/categories?preset=last-3-months&type=in&page=2')

    await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Categorie' })).toHaveAttribute(
      'href',
      '/dashboard/categories?preset=last-3-months&type=in'
    )
    await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard/overview?preset=last-3-months&type=in'
    )
  })

  test('DASH-02 categories route exposes only OUT/IN filters and handles malformed params', async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/dashboard/categories?preset=bad&type=bad')

    await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Uscite' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Entrate' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tutti' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Uscite' })).toHaveAttribute('data-state', 'active')
  })

  test('DASH-02 category filters update the URL and persist across dashboard tabs', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/dashboard/categories')

    await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Uscite' })).toHaveAttribute('data-state', 'active')
    await expect(page.getByRole('tab', { name: 'Entrate' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tutti' })).toHaveCount(0)

    await page.getByRole('combobox', { name: 'Periodo dashboard' }).click()
    await page.getByRole('option', { name: 'Ultimi 3 mesi' }).click()
    await expect(page).toHaveURL(/\/dashboard\/categories\?preset=last-3-months$/)

    await page.getByRole('tab', { name: 'Entrate' }).click()
    await expect(page).toHaveURL(/\/dashboard\/categories\?preset=last-3-months&type=in$/)
    await expect(page.getByRole('tab', { name: 'Entrate' })).toHaveAttribute(
      'data-state',
      'active'
    )

    await page.getByRole('link', { name: 'Overview' }).click()
    await expect(page).toHaveURL(/\/dashboard\/overview\?preset=last-3-months&type=in$/)
  })

  test('DASH-02 category rows link to drill-down or show the empty state', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
    })
    await page.goto('/dashboard/categories?preset=last-3-months&type=in')

    await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()

    const ranking = page.getByRole('list', { name: 'Classifica categorie' })
    if ((await ranking.count()) === 0) {
      await expect(page.getByText('Nessuna categoria nel periodo selezionato')).toBeVisible()
      return
    }

    await expect(ranking).toBeVisible()
    const firstCategoryLink = page.getByRole('link', {
      name: /apri dettaglio categoria/i,
    }).first()

    await expect(firstCategoryLink).toHaveAttribute(
      'href',
      /^\/dashboard\/categories\/[^?]+\?preset=last-3-months&type=in$/
    )

    await firstCategoryLink.click()
    await expect(page).toHaveURL(/\/dashboard\/categories\/[^/?]+\?preset=last-3-months&type=in$/)
  })
})

test.describe('Dashboard - DASH-03: Monthly trend', () => {
  test('DASH-03 trend chart renders grouped series controls', async ({ page }) => {
    await openDashboard(page)

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
