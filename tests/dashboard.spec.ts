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

  test('LENS switch is absent on /dashboard/categories and /dashboard/categories/[id], and Categories always reads cassa regardless of ?lens= (D-12, review fix CR-01)', async ({
    page,
  }) => {
    await openDashboardPath(page, '/dashboard/categories')
    await expect(page.getByRole('button', { name: 'Competenza' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)

    const ranking = page.getByRole('list', { name: 'Classifica categorie' })
    const cassaListSnapshot = (await ranking.count()) > 0 ? await ranking.innerText() : null

    await openDashboardPath(page, '/dashboard/categories?lens=competenza')
    await expect(page.getByRole('button', { name: 'Competenza' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
    // D-12: Categories always reads cassa — the list must be byte-identical regardless of
    // whatever ?lens= the URL carries (the value is forwarded, per D-13, but never consumed).
    const lensListSnapshot = (await ranking.count()) > 0 ? await ranking.innerText() : null
    expect(lensListSnapshot).toBe(cassaListSnapshot)

    const firstCategoryLink = page
      .getByRole('link', { name: /apri dettaglio categoria/i })
      .first()
    const detailPath =
      (await firstCategoryLink.count()) > 0
        ? new URL((await firstCategoryLink.getAttribute('href')) as string, page.url()).pathname
        : '/dashboard/categories/1'

    await openDashboardPath(page, detailPath)
    await expect(page.getByRole('button', { name: 'Competenza' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
    await expectCategoryDetailContentOrEmptyState(page)
    const summary = page.getByRole('region', { name: 'Riepilogo categoria' })
    const cassaDetailSnapshot = (await summary.count()) > 0 ? await summary.innerText() : null

    await openDashboardPath(page, `${detailPath}?lens=competenza`)
    await expect(page.getByRole('button', { name: 'Competenza' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
    await expectCategoryDetailContentOrEmptyState(page)
    const lensDetailSnapshot = (await summary.count()) > 0 ? await summary.innerText() : null
    expect(lensDetailSnapshot).toBe(cassaDetailSnapshot)
  })

  test('no lens control renders on /dashboard/tags (LSD-05; stale since d12bb7ff, not from Phase 82)', async ({
    page,
  }) => {
    await openDashboardPath(page, '/dashboard/tags')

    await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Competenza' })).toHaveCount(0)
    await expect(
      page.getByText('i tag sono all-time: la lente non cambia i totali')
    ).toHaveCount(0)
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
