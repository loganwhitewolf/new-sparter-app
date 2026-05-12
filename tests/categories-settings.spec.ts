import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  canRunCategorySettingsFlow,
  categorySettingsSkipReason,
  cleanupCategorySettingsSeed,
  makeCategorySettingsSeed,
  prepareCategorySettingsSeed,
  type CategorySettingsSeed,
} from './category-settings-seed'

function categoryRow(page: Page, name: string) {
  return page.locator(`[aria-label="Categoria ${name}"]`)
}

function subcategoryRow(page: Page, name: string) {
  return page.locator(`[aria-label="Sottocategoria ${name}"]`)
}

async function submitDialog(dialog: Locator, buttonName: string) {
  await dialog.getByRole('button', { name: buttonName }).click()
  await expect(dialog).toBeHidden()
}

async function chooseRadixOption(page: Page, trigger: Locator, optionName: string) {
  await trigger.click()
  await page.getByRole('option', { name: optionName, exact: true }).click()
}

async function createCategory(page: Page, seed: CategorySettingsSeed) {
  await page.getByRole('button', { name: 'Crea categoria personale' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuova categoria personale' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome categoria').fill(seed.createdCategoryName)
  await submitDialog(dialog, 'Crea categoria')
  await expect(categoryRow(page, seed.createdCategoryName)).toBeVisible()
}

async function createSubcategory(page: Page, seed: CategorySettingsSeed) {
  const row = categoryRow(page, seed.createdCategoryName)
  await row.getByRole('button', { name: `Crea sottocategoria in ${seed.createdCategoryName}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuova sottocategoria' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome sottocategoria').fill(seed.createdSubcategoryName)
  await submitDialog(dialog, 'Crea sottocategoria')
  await expect(subcategoryRow(page, seed.createdSubcategoryName)).toBeVisible()
}

async function renameCategory(page: Page, seed: CategorySettingsSeed) {
  const row = categoryRow(page, seed.createdCategoryName)
  await row.getByRole('button', { name: `Rinomina categoria ${seed.createdCategoryName}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Rinomina categoria personale' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome categoria').fill(seed.createdCategoryRenamedName)
  await submitDialog(dialog, 'Salva modifiche')
  await expect(categoryRow(page, seed.createdCategoryRenamedName)).toBeVisible()
}

async function renameSubcategory(page: Page, seed: CategorySettingsSeed) {
  const row = subcategoryRow(page, seed.createdSubcategoryName)
  await row.getByRole('button', { name: `Rinomina sottocategoria ${seed.createdSubcategoryName}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Rinomina sottocategoria personale' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome sottocategoria').fill(seed.createdSubcategoryRenamedName)
  await submitDialog(dialog, 'Salva modifiche')
  await expect(subcategoryRow(page, seed.createdSubcategoryRenamedName)).toBeVisible()
}

async function overrideSystemSubcategory(page: Page, seed: CategorySettingsSeed) {
  const row = subcategoryRow(page, seed.systemSubcategoryOriginalName).first()
  await expect(row).toBeVisible()
  await row
    .getByRole('button', { name: `Personalizza nome sottocategoria ${seed.systemSubcategoryOriginalName}` })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Nome personale per sottocategoria di sistema' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome sottocategoria').fill(seed.systemSubcategoryOverrideName)
  await submitDialog(dialog, 'Salva modifiche')
  await expect(subcategoryRow(page, seed.systemSubcategoryOverrideName)).toBeVisible()
  await expect(subcategoryRow(page, seed.systemSubcategoryOverrideName)).toContainText(
    `Nome originale: ${seed.systemSubcategoryOriginalName}`,
  )
}

async function assertLinkedDeleteBlocked(page: Page, seed: CategorySettingsSeed) {
  const row = subcategoryRow(page, seed.linkedSubcategoryName)
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Elimina sottocategoria ${seed.linkedSubcategoryName}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Elimina sottocategoria personale' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Elimina' }).click()
  await expect(dialog.getByText('Non puoi eliminare questa sottocategoria: è collegata a 1 spesa.')).toBeVisible()
  await expect(row).toBeVisible()
  await dialog.getByRole('button', { name: 'Annulla' }).click()
  await expect(dialog).toBeHidden()
}

async function deleteUnlinkedSubcategory(page: Page, seed: CategorySettingsSeed) {
  const row = subcategoryRow(page, seed.unlinkedSubcategoryName)
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Elimina sottocategoria ${seed.unlinkedSubcategoryName}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Elimina sottocategoria personale' })
  await expect(dialog).toBeVisible()
  await submitDialog(dialog, 'Elimina')
  await expect(row).toBeHidden()
}

async function createPatternFromCategoriesPage(page: Page, seed: CategorySettingsSeed) {
  await page.getByRole('button', { name: 'Nuovo pattern' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuovo pattern personalizzato' })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Pattern regex').fill(seed.pattern)
  await chooseRadixOption(page, dialog.getByRole('combobox').nth(0), seed.createdCategoryRenamedName)
  await chooseRadixOption(page, dialog.getByRole('combobox').nth(1), seed.createdSubcategoryRenamedName)
  await dialog.getByLabel('Descrizione').fill(seed.patternDescription)

  await submitDialog(dialog, 'Crea pattern')

  const patternRow = page.getByRole('row').filter({ hasText: seed.pattern })
  await expect(patternRow).toBeVisible()
  await expect(patternRow).toContainText(`${seed.createdCategoryRenamedName} → ${seed.createdSubcategoryRenamedName}`)
  await expect(patternRow).toContainText(seed.patternDescription)
}

test.describe('/settings/categories acceptance flow', () => {
  test('creates, renames, blocks unsafe deletion, deletes safe rows, overrides system names, and assigns patterns', async ({ page }) => {
    test.skip(!canRunCategorySettingsFlow(), categorySettingsSkipReason())

    const seed = makeCategorySettingsSeed()
    await prepareCategorySettingsSeed(seed)

    try {
      await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY! })
      await page.goto('/settings/categories')

      await expect(page.getByRole('heading', { name: 'Categorie' })).toBeVisible()
      await expect(page.getByText('Gestione categorie')).toBeVisible()
      await expect(page.getByText('Pattern di categorizzazione', { exact: true })).toBeVisible()

      await createCategory(page, seed)
      await createSubcategory(page, seed)
      await renameCategory(page, seed)
      await renameSubcategory(page, seed)
      await overrideSystemSubcategory(page, seed)
      await assertLinkedDeleteBlocked(page, seed)
      await deleteUnlinkedSubcategory(page, seed)
      await createPatternFromCategoriesPage(page, seed)
    } finally {
      await cleanupCategorySettingsSeed(seed)
    }
  })
})
