import { expect, test, type Page } from '@playwright/test'

async function openDashboard(page: Page) {
  await openDashboardPath(page, '/dashboard')
}

async function openDashboardPath(page: Page, path: string) {
  await page.setExtraHTTPHeaders({
    'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  })
  await page.goto(path)
}

function collectPageErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  return errors
}

async function expectCategoryDetailContentOrEmptyState(page: Page) {
  await expect(
    page.getByText(/Totale categoria|Nessun dato per questa categoria/)
  ).toBeVisible()
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

  test('DASH-02 category detail route preserves dashboard state and renders safely', async ({
    page,
  }) => {
    const pageErrors = collectPageErrors(page)
    await openDashboardPath(page, '/dashboard/categories?preset=last-3-months&type=in')

    await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard/overview?preset=last-3-months&type=in'
    )
    await expect(page.getByRole('link', { name: 'Categorie' })).toHaveAttribute(
      'href',
      '/dashboard/categories?preset=last-3-months&type=in'
    )

    const ranking = page.getByRole('list', { name: 'Classifica categorie' })
    const firstCategoryLink = page.getByRole('link', {
      name: /apri dettaglio categoria/i,
    }).first()

    if ((await firstCategoryLink.count()) > 0) {
      await expect(ranking).toBeVisible()
      await expect(firstCategoryLink).toHaveAttribute(
        'href',
        /^\/dashboard\/categories\/[^?]+\?preset=last-3-months&type=in$/
      )
      await firstCategoryLink.click()
    } else {
      await expect(page.getByText('Nessuna categoria nel periodo selezionato')).toBeVisible()
      await openDashboardPath(page, '/dashboard/categories/1?preset=last-3-months&type=in')
    }

    await expect(page).toHaveURL(/\/dashboard\/categories\/[^/?]+\?preset=last-3-months&type=in$/)
    await expect(page.getByRole('heading', { name: 'Dettaglio categoria' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard/overview?preset=last-3-months&type=in'
    )
    await expect(page.getByRole('link', { name: 'Categorie', exact: true })).toHaveAttribute(
      'href',
      '/dashboard/categories?preset=last-3-months&type=in'
    )
    await expect(page.getByRole('link', { name: 'Categorie', exact: true })).toHaveClass(/text-primary/)
    await expect(page.getByRole('tab', { name: 'Entrate' })).toHaveAttribute(
      'data-state',
      'active'
    )
    await expectCategoryDetailContentOrEmptyState(page)

    await page.getByRole('link', { name: /torna alle categorie/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/categories\?preset=last-3-months&type=in$/)
    expect(pageErrors).toEqual([])
  })

  test('DASH-02 malformed category detail params fall back without crashing', async ({ page }) => {
    const pageErrors = collectPageErrors(page)
    await openDashboardPath(page, '/dashboard/categories/not-a-number?preset=bad&type=all')

    await expect(page).toHaveURL(/\/dashboard\/categories\/not-a-number\?preset=bad&type=all$/)
    await expect(page.getByRole('heading', { name: 'Dettaglio categoria' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Uscite' })).toHaveAttribute('data-state', 'active')
    await expect(page.getByRole('tab', { name: 'Tutti' })).toHaveCount(0)
    await expect(page.getByText('Nessun dato per questa categoria')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard/overview?preset=bad&type=all'
    )
    await expect(page.getByRole('link', { name: 'Categorie', exact: true })).toHaveAttribute(
      'href',
      '/dashboard/categories?preset=bad&type=all'
    )

    await page.getByRole('link', { name: /torna alle categorie/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/categories$/)
    expect(pageErrors).toEqual([])
  })
})

test.describe('Dashboard - LENS: cassa/competenza switch', () => {
  test('LENS switch renders on /dashboard/overview and flipping it updates the URL', async ({
    page,
  }) => {
    await openDashboardPath(page, '/dashboard/overview')

    const competenzaButton = page.getByRole('button', { name: 'Competenza' })
    await expect(competenzaButton).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cassa' })).toBeVisible()

    await competenzaButton.click()
    await expect(page).toHaveURL(/\?lens=competenza/)
    await expect(competenzaButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('LENS switch renders and is functional on /dashboard/categories and /dashboard/categories/[id]', async ({
    page,
  }) => {
    await openDashboardPath(page, '/dashboard/categories')

    let competenzaButton = page.getByRole('button', { name: 'Competenza' })
    await expect(competenzaButton).toBeVisible()
    await competenzaButton.click()
    await expect(page).toHaveURL(/\?lens=competenza/)
    await expect(competenzaButton).toHaveAttribute('aria-pressed', 'true')

    const firstCategoryLink = page
      .getByRole('link', { name: /apri dettaglio categoria/i })
      .first()

    if ((await firstCategoryLink.count()) > 0) {
      await firstCategoryLink.click()
      // WR-02/CR-02 regression guard: the category-row click-through must land on a URL
      // that ALREADY carries ?lens=competenza (buildDashboardCategoryDetailHref forwarding the
      // lens) — asserted BEFORE the switch is touched again, so this can actually fail if the
      // lens silently reverted to cassa on navigation.
      await expect(page).toHaveURL(/\?.*lens=competenza/)
      competenzaButton = page.getByRole('button', { name: 'Competenza' })
      await expect(competenzaButton).toBeVisible()
      await expect(competenzaButton).toHaveAttribute('aria-pressed', 'true')
    } else {
      await openDashboardPath(page, '/dashboard/categories/1')
      competenzaButton = page.getByRole('button', { name: 'Competenza' })
      await expect(competenzaButton).toBeVisible()
    }

    await competenzaButton.click()
    await expect(page).toHaveURL(/\?lens=competenza/)
    await expect(competenzaButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('LENS switch is disabled with the explanatory note on /dashboard/tags', async ({
    page,
  }) => {
    await openDashboardPath(page, '/dashboard/tags')

    await expect(page.getByRole('button', { name: 'Cassa' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Competenza' })).toBeDisabled()
    await expect(
      page.getByText('i tag sono all-time: la lente non cambia i totali')
    ).toBeVisible()
  })

  test('lens survives tab navigation', async ({ page }) => {
    await openDashboardPath(page, '/dashboard/overview?lens=competenza')

    await page.getByRole('link', { name: 'Categorie' }).click()
    await expect(page).toHaveURL(/lens=competenza/)
  })

  test('no switch exists on /tags/[id]', async ({ page }) => {
    await openDashboardPath(page, '/dashboard/tags')

    const firstTagLink = page.getByRole('link', { name: /apri il tag/i }).first()

    if ((await firstTagLink.count()) > 0) {
      await firstTagLink.click()
      await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
    } else {
      await openDashboardPath(page, '/tags/1')
      await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
    }
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
