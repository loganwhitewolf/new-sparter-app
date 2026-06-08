// Additive seed steps — runs after yarn db:seed. Each step is idempotent.
// Add new steps to the STEPS array; existing steps are re-run safely.
// Usage mirrors yarn db:seed:
//   yarn db:seed-extras              → DATABASE_URL
//   yarn db:seed-extras:staging      → STAGING_DATABASE_URL
//   yarn db:seed-extras:production   → PRODUCTION_DATABASE_URL + PRODUCTION_MIGRATION_CONFIRM
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { categorizationPattern, category, expense, platform, subCategory } from '../lib/db/schema'
import type { FlowNature } from '../lib/utils/nature-labels'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
} from './db-config'

loadOperatorEnv()

const seedTarget = resolveOperatorDatabaseTarget()
const seedConfigResult = getOperatorDatabaseConfig({ target: seedTarget })

if (!seedConfigResult.ok) {
  console.error(JSON.stringify({ event: 'seed_extras_failed', target: seedTarget, error: seedConfigResult.error }))
  process.exit(1)
}

const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

console.log(JSON.stringify({
  event: 'seed_extras_connection',
  target: seedDiagnostics.target,
  host: seedDiagnostics.host,
}))

if (isDirectSupabaseHost(seedDiagnostics.host)) {
  const hint = operatorConnectionFailureHint(seedDiagnostics.host, seedDiagnostics.target)
  if (hint) console.warn(JSON.stringify({ event: 'seed_extras_connection_warning', message: hint }))
}

const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
const db = drizzle(pool)

type Db = typeof db

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

// Step 1 (phase 37): set FlowNature on system subcategories
// trasferimento and addebito-carta-di-credito are intentionally null — no UPDATE needed
const NATURE_SLUGS: Record<FlowNature, string[]> = {
  extraordinary: [
    'conto-risparmio',
    'fondo-emergenze',
    'fondo-pensione',
    'risparmio-per-progetti',
    'risparmio-per-investimenti',
    'obiettivi-a-lungo-termine',
    'risparmio-per-salute',
  ],
  operational: [
    'altri-abbonamenti',
    'streaming-video',
    'streaming-musica',
    'software-e-app',
    'servizi-telefonici-e-internet',
    'piattaforme-didattiche',
    'banca',
    'auto',
    'casa',
    'salute',
    'viaggio',
    'responsabilita-civile',
    'animali-domestici',
    'imposte',
    'imposte-governative',
    'bolli-auto',
    'commissioni-bancarie',
    'corsi-online',
    'universita',
    'corsi-di-specializzazione',
  ],
  discretionary: [
    'alloggio',
    'trasporto',
    'attivita-e-intrattenimento',
    'cibo-e-bevande',
    'assicurazione-viaggio',
    'compleanni',
    'festivita',
    'anniversari',
    'amici-e-conoscenti',
    'cene-fuori',
    'pranzi',
    'colazioni-e-snack',
    'take-away',
    'elettronica',
    'abbigliamento',
    'prodotti-per-la-casa',
    'giocattoli',
    'scarpe',
    'accessori',
    'attrezzatura-sportiva',
    'libri-cartacei',
    'e-book',
    'audiolibri',
    'cinema',
    'eventi',
    'cure-estetiche',
    'sport',
    'psicologia',
    'massaggi',
    'corsi-fitness',
  ],
  essential: [
    'carburante',
    'elettricita-per-auto',
    'mezzi-pubblici',
    'taxi-e-ride-sharing',
    'treno',
    'pedaggi-autostradali',
    'spese-telepass',
    'ztl-e-parcheggi',
    'supermercato',
    'spesa-online',
    'prodotti-freschi',
    'prodotti-non-alimentari',
    'spesa-bio',
    'visite-mediche',
    'farmaci-e-medicinali',
    'trattamenti-medici',
    'farmaci-generici',
    'parafarmaceutici',
    'spese-scolastiche',
    'attivita-extra-scolastiche',
    'baby-sitter',
    'manutenzione-ordinaria',
    'ristrutturazione',
    'affitto',
    'badante',
    'servizi-di-pulizia',
    'energia-elettrica',
    'gas',
    'acqua',
    'rifiuti',
  ],
  income: [
    'stipendio-base',
    'bonus',
    'indennita',
    'overtime',
    'freelance',
    'consulenze',
    'progetti-occasionali',
    'commissioni',
    'dividendi-azionari',
    'dividendi-fondi-comuni',
    'dividendi-immobiliari',
  ],
  financial: [
    'azioni',
    'obbligazioni',
    'criptovalute',
    'fondi-comuni',
    'immobili',
    'rimborso-spese-lavorative',
    'rimborso-spese-sanitarie',
    'rimborso-spese-viaggi',
    'rimborso-ordine-online',
    'cashback-carta-di-credito',
    'cashback-acquisti-online',
    'cashback-programmi-fedelta',
    'sconto-abbonamento',
    'sconto-promozionale',
    'sconto-canone',
    'vendita-di-beni-usati',
    'commercio-online',
    'immobili-vendita',
    'vendita-investimenti',
    'bonifico-in-entrata',
    'ricariche-conti',
    'bonifico-in-uscita',
    'rimborsi',
  ],
  debt: [
    'mutuo-casa',
    'finanziamenti-auto',
    'altri-finanziamenti',
  ],
  transfer: [],
  // Phase 42: income split — extraordinary (one-off / non-recurring) income subcategories.
  // Candidata base confirmed: dividends (dividendi-*) stay in `income` (recurring).
  // Slugs from `income` that move here: one-off/variable earnings.
  // Slugs from `financial` that move here: all IN-side money flows (D-03).
  // Post-step-4 renamed slugs included: rimborso-abbonamento-e-canoni, bonus-promozionale, rimborso-da-persona.
  income_extraordinary: [
    // From income nature: one-off / variable earnings
    'bonus',
    'freelance',
    'consulenze',
    'progetti-occasionali',
    'commissioni',
    // From financial nature: IN-side money flows (per D-03, financial stays OUT/investment only)
    'rimborso-spese-lavorative',
    'rimborso-spese-sanitarie',
    'rimborso-spese-viaggi',
    'rimborso-ordine-online',
    'cashback-carta-di-credito',
    'cashback-acquisti-online',
    'cashback-programmi-fedelta',
    'rimborso-abbonamento-e-canoni',   // renamed from sconto-abbonamento by step 4
    'bonus-promozionale',               // renamed from sconto-promozionale by step 4
    'rimborso-da-persona',              // inserted by step 4
    'vendita-di-beni-usati',
    'commercio-online',
    'immobili-vendita',
    'vendita-investimenti',
    'bonifico-in-entrata',
    'ricariche-conti',
    'rimborsi',
  ],
}

async function setSubcategoryNature(database: Db): Promise<void> {
  let totalUpdated = 0
  for (const [nature, slugs] of Object.entries(NATURE_SLUGS) as [FlowNature, string[]][]) {
    if (slugs.length === 0) continue
    const result = await database.update(subCategory).set({ nature }).where(inArray(subCategory.slug, slugs))
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    nature=${nature}: ${count} rows updated`)
    totalUpdated += count
  }
  console.log(`    total: ${totalUpdated} rows updated`)
}

// Step 2 (phase description-strip-pattern): set descriptionStripPattern on Fineco platform
async function setFinecoDescriptionStripPattern(database: Db): Promise<void> {
  const result = await database
    .update(platform)
    .set({ descriptionStripPattern: '\\s+Carta N\\..*$' })
    .where(eq(platform.slug, 'fineco'))
  const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    fineco description_strip_pattern: ${count} rows updated`)
}

// Step 3 (quick-260531-fko): reorganize grocery category (categoryId 8) subcategory taxonomy
// Ordering is critical: migrate expenses + patterns BEFORE deactivating deprecated rows.
// isActive=false hides subcategories from dashboard/expense queries, so any expense not
// remapped first would be silently dropped from listings.
async function reorganizeSpesaSubcategories(database: Db): Promise<void> {
  // 1. Rename deprecated slug → bio-e-naturale.
  // Guard: if bio-e-naturale already exists as a separate row (e.g. seeded by yarn db:seed),
  // skip the rename and deactivate spesa-bio instead — avoids unique slug constraint violation on re-runs.
  const existingBioNaturale = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'bio-e-naturale'), isNull(subCategory.userId)))
    .limit(1)

  if (existingBioNaturale.length > 0) {
    // Target already exists — deactivate spesa-bio if still present
    const deactivateSpaeBio = await database
      .update(subCategory)
      .set({ isActive: false })
      .where(and(eq(subCategory.slug, 'spesa-bio'), isNull(subCategory.userId)))
    const deactivateCount = (deactivateSpaeBio as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    rename spesa-bio → bio-e-naturale: skipped (target exists), deactivated spesa-bio: ${deactivateCount} rows`)
  } else {
    const renameResult = await database
      .update(subCategory)
      .set({ name: 'bio e naturale', slug: 'bio-e-naturale' })
      .where(and(eq(subCategory.slug, 'spesa-bio'), isNull(subCategory.userId)))
    const renameCount = (renameResult as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    rename spesa-bio → bio-e-naturale: ${renameCount} rows updated`)
  }

  // 2. Set nature='essential' on the 4 new subcategory slugs
  const newSlugs = ['discount', 'negozio-di-quartiere', 'mercato-rionale', 'drogheria-e-casalinghi']
  const natureResult = await database
    .update(subCategory)
    .set({ nature: 'essential' as const })
    .where(and(inArray(subCategory.slug, newSlugs), isNull(subCategory.userId)))
  const natureCount = (natureResult as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    set nature=essential on new slugs: ${natureCount} rows updated`)

  // 3. Resolve system subcategory IDs by slug for migration
  const sourceRows = await database
    .select({ id: subCategory.id, slug: subCategory.slug })
    .from(subCategory)
    .where(and(inArray(subCategory.slug, ['prodotti-freschi', 'prodotti-non-alimentari', 'negozio-di-quartiere', 'drogheria-e-casalinghi']), isNull(subCategory.userId)))

  const idBySlug = Object.fromEntries(sourceRows.map((r) => [r.slug, r.id]))

  const prodottiFreschiId = idBySlug['prodotti-freschi']
  const prodottiNonAlimentariId = idBySlug['prodotti-non-alimentari']
  const negozioDiQuartiereId = idBySlug['negozio-di-quartiere']
  const drogheriaECasalinghiId = idBySlug['drogheria-e-casalinghi']

  // 4. Migrate expenses: prodotti-freschi → negozio-di-quartiere
  if (prodottiFreschiId == null || negozioDiQuartiereId == null) {
    console.log(`    skip expense migration (prodotti-freschi → negozio-di-quartiere): source or target already absent`)
  } else {
    const expMigrate1 = await database
      .update(expense)
      .set({ subCategoryId: negozioDiQuartiereId })
      .where(eq(expense.subCategoryId, prodottiFreschiId))
    const expMigrate1Count = (expMigrate1 as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    migrate expenses prodotti-freschi → negozio-di-quartiere: ${expMigrate1Count} rows updated`)
  }

  // 4b. Migrate expenses: prodotti-non-alimentari → drogheria-e-casalinghi
  if (prodottiNonAlimentariId == null || drogheriaECasalinghiId == null) {
    console.log(`    skip expense migration (prodotti-non-alimentari → drogheria-e-casalinghi): source or target already absent`)
  } else {
    const expMigrate2 = await database
      .update(expense)
      .set({ subCategoryId: drogheriaECasalinghiId })
      .where(eq(expense.subCategoryId, prodottiNonAlimentariId))
    const expMigrate2Count = (expMigrate2 as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    migrate expenses prodotti-non-alimentari → drogheria-e-casalinghi: ${expMigrate2Count} rows updated`)
  }

  // 5. Migrate categorization patterns: prodotti-freschi → negozio-di-quartiere
  // unique("categorization_pattern_unique").on(pattern, subCategoryId, amountSign) — must delete
  // prodotti-freschi patterns that already exist for negozio-di-quartiere before migrating the rest.
  if (prodottiFreschiId == null || negozioDiQuartiereId == null) {
    console.log(`    skip pattern migration (prodotti-freschi → negozio-di-quartiere): source or target already absent`)
  } else {
    const patConflictDelete = await database
      .delete(categorizationPattern)
      .where(
        and(
          eq(categorizationPattern.subCategoryId, prodottiFreschiId),
          sql`(${categorizationPattern.pattern}, ${categorizationPattern.amountSign}) IN (SELECT pattern, amount_sign FROM categorization_pattern WHERE sub_category_id = ${negozioDiQuartiereId})`
        )
      )
    const patConflictDeleteCount = (patConflictDelete as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    delete conflicting patterns prodotti-freschi: ${patConflictDeleteCount} rows deleted`)

    const patMigrate = await database
      .update(categorizationPattern)
      .set({ subCategoryId: negozioDiQuartiereId })
      .where(eq(categorizationPattern.subCategoryId, prodottiFreschiId))
    const patMigrateCount = (patMigrate as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    migrate patterns prodotti-freschi → negozio-di-quartiere: ${patMigrateCount} rows updated`)
  }

  // 6. Deactivate deprecated rows (MUST run after migrations above)
  const deactivateResult = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(inArray(subCategory.slug, ['prodotti-freschi', 'prodotti-non-alimentari']), isNull(subCategory.userId)))
  const deactivateCount = (deactivateResult as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    deactivate deprecated subcategories: ${deactivateCount} rows updated`)
}

// Step 4: reorganize Trasferimenti (cat 32) and Rimborsi (cat 26) categories
// - Cat 32 "ignore" → "Trasferimenti" (type: transfer); rename/add subcategories; set excludeFromTotals+nature
// - Cat 28 "movimenti di liquidita" → isActive=false (and its subcategories)
// - Cat 26 "sconti, rimborsi e cashback" → "rimborsi, cashback e bonus"; merge/rename subcategories; add new one
async function reorganizeTransferRimborsiCategories(database: Db): Promise<void> {
  // --- Cat 32: rename to Trasferimenti, change type to transfer ---
  const cat32Result = await database
    .update(category)
    .set({ name: 'Trasferimenti', slug: 'trasferimenti', type: 'transfer' })
    .where(eq(category.id, 32))
  console.log(`    cat32 rename/retype: ${(cat32Result as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)

  // --- Cat 32 subcategories: rename "trasferimento" → "Trasferimento tra conti" ---
  // Guard: if trasferimento-tra-conti already exists, skip rename and deactivate old slug instead.
  const existingTrasferimentoTraConti = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'trasferimento-tra-conti'), isNull(subCategory.userId)))
    .limit(1)

  if (existingTrasferimentoTraConti.length > 0) {
    const deactivateTrasferimento = await database
      .update(subCategory)
      .set({ isActive: false })
      .where(and(eq(subCategory.slug, 'trasferimento'), isNull(subCategory.userId)))
    const deactivateCount = (deactivateTrasferimento as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    sub32 rename trasferimento: skipped (target exists), deactivated old slug: ${deactivateCount} rows`)
  } else {
    const sub32RenameResult = await database
      .update(subCategory)
      .set({ name: 'Trasferimento tra conti', slug: 'trasferimento-tra-conti' })
      .where(and(eq(subCategory.slug, 'trasferimento'), isNull(subCategory.userId)))
    console.log(`    sub32 rename trasferimento: ${(sub32RenameResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)
  }

  // --- Cat 32 subcategories: set excludeFromTotals=true, nature=transfer on all ---
  const sub32NatureResult = await database
    .update(subCategory)
    .set({ excludeFromTotals: true, nature: 'transfer' })
    .where(and(eq(subCategory.categoryId, 32), isNull(subCategory.userId)))
  console.log(`    sub32 set nature/excludeFromTotals: ${(sub32NatureResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)

  // --- Cat 32: insert "Prelievo contante" if not exists (idempotent via slug check) ---
  const existingPrelievo = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'prelievo-contante'), isNull(subCategory.userId)))
    .limit(1)
  if (existingPrelievo.length === 0) {
    await database.insert(subCategory).values({
      categoryId: 32,
      name: 'Prelievo contante',
      slug: 'prelievo-contante',
      displayOrder: 0,
      isActive: true,
      excludeFromTotals: true,
      nature: 'transfer',
    })
    console.log('    sub32 insert prelievo-contante: 1 row inserted')
  } else {
    console.log('    sub32 insert prelievo-contante: already exists, skipped')
  }

  // --- Cat 28: deactivate category and its subcategories ---
  const cat28Result = await database
    .update(category)
    .set({ isActive: false })
    .where(eq(category.id, 28))
  console.log(`    cat28 deactivate: ${(cat28Result as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)

  const sub28Result = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(eq(subCategory.categoryId, 28), isNull(subCategory.userId)))
  console.log(`    sub28 deactivate: ${(sub28Result as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)

  // --- Cat 26: rename category ---
  const cat26Result = await database
    .update(category)
    .set({ name: 'rimborsi, cashback e bonus', slug: 'rimborsi-cashback-e-bonus' })
    .where(eq(category.id, 26))
  console.log(`    cat26 rename: ${(cat26Result as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)

  // --- Cat 26: rename sconto-abbonamento → rimborso-abbonamento-e-canoni ---
  // Guard: if target already exists, deactivate old slug instead of renaming.
  const existingRimborsoAbbonamento = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'rimborso-abbonamento-e-canoni'), isNull(subCategory.userId)))
    .limit(1)
  if (existingRimborsoAbbonamento.length > 0) {
    const deactivateScontoAbbona = await database
      .update(subCategory)
      .set({ isActive: false })
      .where(and(eq(subCategory.slug, 'sconto-abbonamento'), isNull(subCategory.userId)))
    console.log(`    sub26 rename sconto-abbonamento: skipped (target exists), deactivated: ${(deactivateScontoAbbona as unknown as { rowCount?: number }).rowCount ?? 0} rows`)
  } else {
    const sub26AbbonaResult = await database
      .update(subCategory)
      .set({ name: 'rimborso abbonamento e canoni', slug: 'rimborso-abbonamento-e-canoni' })
      .where(and(eq(subCategory.slug, 'sconto-abbonamento'), isNull(subCategory.userId)))
    console.log(`    sub26 rename sconto-abbonamento: ${(sub26AbbonaResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)
  }

  // --- Cat 26: deactivate sconto-canone (merged into rimborso-abbonamento-e-canoni) ---
  const sub26CanoneResult = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(eq(subCategory.slug, 'sconto-canone'), isNull(subCategory.userId)))
  console.log(`    sub26 deactivate sconto-canone: ${(sub26CanoneResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)

  // --- Cat 26: rename sconto-promozionale → bonus-promozionale ---
  // Guard: if target already exists, deactivate old slug instead of renaming.
  const existingBonusPromozionale = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'bonus-promozionale'), isNull(subCategory.userId)))
    .limit(1)
  if (existingBonusPromozionale.length > 0) {
    const deactivateScontoPromo = await database
      .update(subCategory)
      .set({ isActive: false })
      .where(and(eq(subCategory.slug, 'sconto-promozionale'), isNull(subCategory.userId)))
    console.log(`    sub26 rename sconto-promozionale: skipped (target exists), deactivated: ${(deactivateScontoPromo as unknown as { rowCount?: number }).rowCount ?? 0} rows`)
  } else {
    const sub26PromoResult = await database
      .update(subCategory)
      .set({ name: 'bonus promozionale', slug: 'bonus-promozionale' })
      .where(and(eq(subCategory.slug, 'sconto-promozionale'), isNull(subCategory.userId)))
    console.log(`    sub26 rename sconto-promozionale: ${(sub26PromoResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)
  }

  // --- Cat 26: insert "rimborso da persona" if not exists ---
  const existingRimborsoPersona = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'rimborso-da-persona'), isNull(subCategory.userId)))
    .limit(1)
  if (existingRimborsoPersona.length === 0) {
    await database.insert(subCategory).values({
      categoryId: 26,
      name: 'rimborso da persona',
      slug: 'rimborso-da-persona',
      displayOrder: 0,
      isActive: true,
    })
    console.log('    sub26 insert rimborso-da-persona: 1 row inserted')
  } else {
    console.log('    sub26 insert rimborso-da-persona: already exists, skipped')
  }
}

// Step 5 (phase 42: income split): re-bucket income_extraordinary subcategories
// Guard: isNull(subCategory.userId) ensures only system subcategories are updated.
async function rebucketIncomeNatures(database: Db): Promise<void> {
  const slugs = NATURE_SLUGS['income_extraordinary']
  if (slugs.length === 0) {
    console.log('    income_extraordinary rebucket: slug list empty, skipping (PO confirmation pending)')
    return
  }

  const result = await database
    .update(subCategory)
    .set({ nature: 'income_extraordinary' as FlowNature })
    .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))

  const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
  console.log(`    income_extraordinary rebucket: ${count} rows updated`)
}

// ---------------------------------------------------------------------------
// Registry — append new steps here
// ---------------------------------------------------------------------------

const STEPS: Array<{ name: string; run: (database: Db) => Promise<void> }> = [
  { name: 'set-subcategory-nature', run: setSubcategoryNature },
  { name: 'set-fineco-description-strip-pattern', run: setFinecoDescriptionStripPattern },
  { name: 'reorganize-spesa-subcategories', run: reorganizeSpesaSubcategories },
  { name: 'reorganize-transfer-rimborsi-categories', run: reorganizeTransferRimborsiCategories },
  { name: 'rebucket-income-natures', run: rebucketIncomeNatures },
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runExtras() {
  console.log(JSON.stringify({ event: 'seed_extras_started', target: seedDiagnostics.target, steps: STEPS.length }))

  for (const step of STEPS) {
    console.log(`  [${step.name}] running...`)
    await step.run(db)
    console.log(`  [${step.name}] done`)
  }

  console.log(JSON.stringify({ event: 'seed_extras_succeeded', target: seedDiagnostics.target }))
}

runExtras()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: 'seed_extras_failed', error: String(error) }))
    process.exit(1)
  })
  .finally(() => pool.end())
