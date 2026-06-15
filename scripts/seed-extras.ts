// Additive seed steps — runs after yarn db:seed. Each step is idempotent.
// Add new steps to the STEPS array; existing steps are re-run safely.
// Usage mirrors yarn db:seed:
//   yarn db:seed-extras              → DATABASE_URL
//   yarn db:seed-extras:staging      → STAGING_DATABASE_URL
//   yarn db:seed-extras:production   → PRODUCTION_DATABASE_URL + PRODUCTION_MIGRATION_CONFIRM
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  categorizationPattern,
  category,
  expense,
  nature,
  platform,
  subCategory,
} from '../lib/db/schema'
import {
  DISSOLVED_CATEGORY_SLUGS,
  DROPPED_SUBCATEGORY_SLUGS,
  V2_SUBCATEGORY_MANIFEST,
} from '../tests/fixtures/v2-taxonomy-manifest'
import { categories as v2Categories, subCategories as v2SubCategories } from './seed-data'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
} from './db-config'

type Db = ReturnType<typeof drizzle>

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

// Step 1 (phase 37): sub_category.nature column removed in Phase 46 — no-op, superseded by v2-backfill-nature-id.
async function setSubcategoryNature(_database: Db): Promise<void> {
  console.log('    set-subcategory-nature: no-op (Phase 47 — superseded by v2-backfill-nature-id)')
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
  // skip the rename and deactivate the old slug instead — avoids unique slug constraint violation on re-runs.
  const existingBioNaturale = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'bio-e-naturale'), isNull(subCategory.userId)))
    .limit(1)

  if (existingBioNaturale.length > 0) {
    // Target already exists — deactivate old slug if still present
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

  // 2. Nature assignment deferred to v2-backfill-nature-id (D-12; nature column removed Phase 46)
  console.log('    set nature on new slugs: skipped (deferred to v2-backfill-nature-id)')

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
  // unique("categorization_pattern_unique").on(pattern, subCategoryId) — must delete
  // prodotti-freschi patterns that already exist for negozio-di-quartiere before migrating the rest.
  // Phase 46: amountSign column removed (ADR 0012) — unique constraint now on (pattern, subCategoryId) only
  if (prodottiFreschiId == null || negozioDiQuartiereId == null) {
    console.log(`    skip pattern migration (prodotti-freschi → negozio-di-quartiere): source or target already absent`)
  } else {
    const patConflictDelete = await database
      .delete(categorizationPattern)
      .where(
        and(
          eq(categorizationPattern.subCategoryId, prodottiFreschiId),
          sql`${categorizationPattern.pattern} IN (SELECT pattern FROM categorization_pattern WHERE sub_category_id = ${negozioDiQuartiereId})`
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
  // --- Cat 32: rename to Trasferimenti ---
  // Phase 46: category.type column removed (ADR 0012); type='transfer' retype omitted (historical migration)
  // TODO(Phase 49): direction-based transfer classification replaces category.type
  const cat32Result = await database
    .update(category)
    .set({ name: 'Trasferimenti', slug: 'trasferimenti' })
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

  // --- Cat 32: insert "Prelievo contante" if not exists (idempotent via slug check) ---
  const existingPrelievo = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'prelievo-contante'), isNull(subCategory.userId)))
    .limit(1)
  if (existingPrelievo.length === 0) {
    // Phase 46: nature column removed — set via raw SQL after insert
    // TODO(Phase 49): rewrite to set natureId once nature lookup rows seeded
    await database.insert(subCategory).values({
      categoryId: 32,
      name: 'Prelievo contante',
      slug: 'prelievo-contante',
      displayOrder: 0,
      isActive: true,
    })
    console.log('    sub32 insert prelievo-contante: 1 row inserted (nature deferred to v2-backfill-nature-id)')
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

  // --- Cat 26: rename category (skip when v2 baseline already applied) ---
  const [cat26Row] = await database
    .select({ slug: category.slug })
    .from(category)
    .where(eq(category.id, 26))
    .limit(1)
  if (cat26Row?.slug === 'entrate-straordinarie') {
    console.log('    cat26 rename: skipped (already v2 entrate-straordinarie)')
  } else {
    const cat26Result = await database
      .update(category)
      .set({ name: 'rimborsi, cashback e bonus', slug: 'rimborsi-cashback-e-bonus' })
      .where(eq(category.id, 26))
    console.log(`    cat26 rename: ${(cat26Result as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`)
  }

  // --- Cat 26: deactivate sconto-abbonamento / sconto-canone (v2 step 8 merges into bonus-promozionale) ---
  const sub26AbbonaResult = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(eq(subCategory.slug, 'sconto-abbonamento'), isNull(subCategory.userId)))
  console.log(
    `    sub26 deactivate sconto-abbonamento: ${(sub26AbbonaResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`,
  )

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

  // --- Cat 26: deactivate historical rimborso-da-persona (v2: nets under original expense) ---
  const sub26PersonaResult = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(eq(subCategory.slug, 'rimborso-da-persona'), isNull(subCategory.userId)))
  console.log(
    `    sub26 deactivate rimborso-da-persona: ${(sub26PersonaResult as unknown as { rowCount?: number }).rowCount ?? 0} rows updated`,
  )
}

// Step 5 (phase 42: income split): re-bucket income_extraordinary subcategories.
// D-16: income_extraordinary slug list is PO-confirmed and final for Phase 48.
// The stale skip guard (which checked for an empty slug list) has been removed per D-16.
// Nature assignment is owned by step 11 v2-backfill-nature-id, which reads NATURE_SLUG_MAP
// built from V2_SUBCATEGORY_MANIFEST — the authoritative source. This step is a no-op
// retained in the registry to preserve append-only ordering (steps are never deleted).
async function rebucketIncomeNatures(_database: Db): Promise<void> {
  console.log('    income_extraordinary rebucket: no-op (D-16 — nature assignment owned by v2-backfill-nature-id)')
}

// ---------------------------------------------------------------------------
// v2 taxonomy migration helpers (Phase 47 — deployed DB transforms, D-08)
// ---------------------------------------------------------------------------

async function resolveSystemSubIds(
  database: Db,
  slugs: string[],
): Promise<Record<string, number | undefined>> {
  if (slugs.length === 0) return {}
  const rows = await database
    .select({ id: subCategory.id, slug: subCategory.slug })
    .from(subCategory)
    .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))
  return Object.fromEntries(rows.map((row) => [row.slug, row.id]))
}

async function migrateSubcategoryMerge(
  database: Db,
  sourceSlug: string,
  targetSlug: string,
): Promise<void> {
  const idBySlug = await resolveSystemSubIds(database, [sourceSlug, targetSlug])
  const sourceId = idBySlug[sourceSlug]
  const targetId = idBySlug[targetSlug]

  if (sourceId == null || targetId == null) {
    console.log(`    skip merge ${sourceSlug} → ${targetSlug}: source or target absent`)
    return
  }

  const expMigrate = await database
    .update(expense)
    .set({ subCategoryId: targetId })
    .where(eq(expense.subCategoryId, sourceId))
  console.log(
    `    migrate expenses ${sourceSlug} → ${targetSlug}: ${(expMigrate as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )

  const patConflictDelete = await database
    .delete(categorizationPattern)
    .where(
      and(
        eq(categorizationPattern.subCategoryId, sourceId),
        sql`${categorizationPattern.pattern} IN (SELECT pattern FROM categorization_pattern WHERE sub_category_id = ${targetId})`,
      ),
    )
  console.log(
    `    delete conflicting patterns ${sourceSlug}: ${(patConflictDelete as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )

  const patMigrate = await database
    .update(categorizationPattern)
    .set({ subCategoryId: targetId })
    .where(eq(categorizationPattern.subCategoryId, sourceId))
  console.log(
    `    migrate patterns ${sourceSlug} → ${targetSlug}: ${(patMigrate as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )

  const deactivate = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(eq(subCategory.slug, sourceSlug), isNull(subCategory.userId)))
  console.log(
    `    deactivate source ${sourceSlug}: ${(deactivate as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )
}

async function renameSubcategoryGuarded(
  database: Db,
  sourceSlug: string,
  targetSlug: string,
  targetName: string,
): Promise<void> {
  const existingTarget = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, targetSlug), isNull(subCategory.userId)))
    .limit(1)

  if (existingTarget.length > 0) {
    const deactivate = await database
      .update(subCategory)
      .set({ isActive: false })
      .where(and(eq(subCategory.slug, sourceSlug), isNull(subCategory.userId)))
    console.log(
      `    rename ${sourceSlug} → ${targetSlug}: skipped (target exists), deactivated source: ${(deactivate as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
    )
    return
  }

  const rename = await database
    .update(subCategory)
    .set({ name: targetName, slug: targetSlug })
    .where(and(eq(subCategory.slug, sourceSlug), isNull(subCategory.userId)))
  console.log(
    `    rename ${sourceSlug} → ${targetSlug}: ${(rename as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )
}

async function renameCategoryGuarded(
  database: Db,
  sourceSlug: string,
  targetSlug: string,
  targetName: string,
): Promise<void> {
  const existingTarget = await database
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.slug, targetSlug), isNull(category.userId)))
    .limit(1)

  if (existingTarget.length > 0) {
    const deactivate = await database
      .update(category)
      .set({ isActive: false })
      .where(and(eq(category.slug, sourceSlug), isNull(category.userId)))
    console.log(
      `    rename category ${sourceSlug} → ${targetSlug}: skipped (target exists), deactivated source: ${(deactivate as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
    )
    return
  }

  const rename = await database
    .update(category)
    .set({ name: targetName, slug: targetSlug })
    .where(and(eq(category.slug, sourceSlug), isNull(category.userId)))
  console.log(
    `    rename category ${sourceSlug} → ${targetSlug}: ${(rename as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )
}

// Step 6: INSERT net-new v2 categories and subcategories absent from v1 baseline
async function v2InsertCategoriesSubcategories(database: Db): Promise<void> {
  let categoriesInserted = 0
  for (const cat of v2Categories) {
    const existingBySlug = await database
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.slug, cat.slug), isNull(category.userId)))
      .limit(1)
    if (existingBySlug.length > 0) continue

    // Also guard by ID: a category seeded under a different (pre-rename) slug already occupies
    // this PK and will be renamed by the v2-rename-categories-subcategories step — skip insertion.
    if (cat.id !== undefined) {
      const existingById = await database
        .select({ id: category.id })
        .from(category)
        .where(and(eq(category.id, cat.id), isNull(category.userId)))
        .limit(1)
      if (existingById.length > 0) continue
    }

    await database.insert(category).values({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      displayOrder: cat.displayOrder,
      isActive: cat.isActive,
    })
    categoriesInserted += 1
    console.log(`    insert category ${cat.slug}: 1 row`)
  }
  console.log(`    categories inserted: ${categoriesInserted}`)

  let subsInserted = 0
  for (const sub of v2SubCategories) {
    const existing = await database
      .select({ id: subCategory.id })
      .from(subCategory)
      .where(and(eq(subCategory.slug, sub.slug), isNull(subCategory.userId)))
      .limit(1)
    if (existing.length > 0) continue

    await database.insert(subCategory).values({
      categoryId: sub.categoryId,
      name: sub.name,
      slug: sub.slug,
      displayOrder: sub.displayOrder,
      isActive: sub.isActive,
    })
    subsInserted += 1
  }
  console.log(`    subcategories inserted: ${subsInserted} (nature_id deferred to v2-backfill-nature-id)`)
}

const OUT_MERGE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['supermercato', 'spesa-quotidiana'],
  ['spesa-online', 'spesa-quotidiana'],
  ['prodotti-freschi', 'spesa-quotidiana'],
  ['prodotti-non-alimentari', 'casalinghi-e-non-alimentari'],
  ['negozio-di-quartiere', 'spesa-quotidiana'],
  ['drogheria-e-casalinghi', 'casalinghi-e-non-alimentari'],
  ['discount', 'spesa-quotidiana'],
  ['mercato-rionale', 'spesa-quotidiana'],
  ['spesa-bio', 'bio-vino-e-gourmet'],
  ['bio-e-naturale', 'bio-vino-e-gourmet'],
  ['cene-fuori', 'ristoranti'],
  ['pranzi', 'ristoranti'],
  ['colazioni-e-snack', 'bar-caffe-e-snack'],
  ['take-away', 'take-away-e-delivery'],
  ['carburante', 'carburante-e-ricarica'],
  ['elettricita-per-auto', 'carburante-e-ricarica'],
  ['pedaggi-autostradali', 'pedaggi-e-parcheggi'],
  ['spese-telepass', 'pedaggi-e-parcheggi'],
  ['ztl-e-parcheggi', 'pedaggi-e-parcheggi'],
  ['treno', 'mezzi-pubblici'],
  ['farmaci-e-medicinali', 'farmaci'],
  ['farmaci-generici', 'farmaci'],
  ['parafarmaceutici', 'farmaci'],
  ['manutenzione-ordinaria', 'manutenzione-casa'],
  ['badante', 'servizi-domestici'],
  ['baby-sitter', 'servizi-domestici'],
  ['servizi-di-pulizia', 'servizi-domestici'],
  ['servizi-telefonici-e-internet', 'telefono-e-internet'],
  ['imposte-governative', 'imposte'],
  ['commissioni-bancarie', 'commissioni-e-canone-conto'],
  ['corsi-online', 'corsi'],
  ['corsi-di-specializzazione', 'corsi'],
  ['piattaforme-didattiche', 'corsi'],
  ['attivita-extra-scolastiche', 'corsi'],
  ['abbigliamento', 'abbigliamento-e-accessori'],
  ['scarpe', 'abbigliamento-e-accessori'],
  ['accessori', 'abbigliamento-e-accessori'],
  ['attrezzatura-sportiva', 'attrezzatura-e-abbigliamento-sportivo'],
  ['streaming-video', 'streaming'],
  ['streaming-musica', 'streaming'],
  ['libri-cartacei', 'libri-e-audiolibri'],
  ['e-book', 'libri-e-audiolibri'],
  ['audiolibri', 'libri-e-audiolibri'],
  ['cinema', 'cinema-ed-eventi'],
  ['eventi', 'cinema-ed-eventi'],
  ['software-e-app', 'app-e-software'],
  ['altri-abbonamenti', 'app-e-software'],
  ['banca', 'commissioni-e-canone-conto'],
  ['sport', 'sport-e-fitness'],
  ['cure-estetiche', 'cura-della-persona'],
  ['massaggi', 'cura-della-persona'],
  ['corsi-fitness', 'sport-e-fitness'],
  ['compleanni', 'regali'],
  ['festivita', 'regali'],
  ['anniversari', 'regali'],
  ['amici-e-conoscenti', 'regali'],
  ['auto', 'assicurazione-veicoli'],
  ['viaggio', 'assicurazione-viaggio'],
  ['animali-domestici', 'assicurazione-animali'],
  ['responsabilita-civile', 'assicurazione-veicoli'],
]

// Step 7: OUT merges and wrapper dissolutions (expense → pattern → deactivate)
async function v2MigrateMergesOut(database: Db): Promise<void> {
  for (const [sourceSlug, targetSlug] of OUT_MERGE_PAIRS) {
    await migrateSubcategoryMerge(database, sourceSlug, targetSlug)
  }

  // Assicurazioni wrapper subs with slug collisions — migrate by resolved IDs
  await migrateSubcategoryMerge(database, 'casa', 'assicurazione-casa')
  await migrateSubcategoryMerge(database, 'salute', 'assicurazione-salute')
}

const IN_ALLOCATION_TRANSFER_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['dividendi-azionari', 'dividendi'],
  ['dividendi-fondi-comuni', 'dividendi'],
  ['dividendi-immobiliari', 'dividendi'],
  ['azioni', 'titoli-e-fondi'],
  ['obbligazioni', 'titoli-e-fondi'],
  ['fondi-comuni', 'titoli-e-fondi'],
  ['bonifico-in-uscita', 'trasferimento-tra-conti'],
  ['bonifico-in-entrata', 'trasferimento-tra-conti'],
  ['ricariche-conti', 'trasferimento-tra-conti'],
  ['trasferimento', 'trasferimento-tra-conti'],
  ['risparmio-per-progetti', 'accantonamenti-obiettivi'],
  ['obiettivi-a-lungo-termine', 'accantonamenti-obiettivi'],
  ['risparmio-per-salute', 'accantonamenti-obiettivi'],
  ['risparmio-per-investimenti', 'accantonamenti-obiettivi'],
  ['fondo-pensione', 'previdenza-complementare'],
  ['cashback-carta-di-credito', 'cashback'],
  ['cashback-acquisti-online', 'cashback'],
  ['cashback-programmi-fedelta', 'cashback'],
  ['vendita-di-beni-usati', 'vendita-beni-usati'],
  ['commercio-online', 'vendita-beni-usati'],
  ['vendita-investimenti', 'immobili'],
  ['immobili-vendita', 'immobili'],
  // step-4 historical orphans → v2 income_extraordinary targets (CR-01)
  ['sconto-abbonamento', 'bonus-promozionale'],
  ['rimborso-abbonamento-e-canoni', 'bonus-promozionale'],
  ['rimborso-da-persona', 'cashback'],
]

// Step 8: IN / ALLOCATION / TRANSFER merges (extends step 4 idempotently)
async function v2MigrateMergesInAllocationTransfer(database: Db): Promise<void> {
  for (const [sourceSlug, targetSlug] of IN_ALLOCATION_TRANSFER_PAIRS) {
    await migrateSubcategoryMerge(database, sourceSlug, targetSlug)
  }

  // prelievo-contante → contante: rename if target absent, else merge
  const contanteExists = await database
    .select({ id: subCategory.id })
    .from(subCategory)
    .where(and(eq(subCategory.slug, 'contante'), isNull(subCategory.userId)))
    .limit(1)
  if (contanteExists.length > 0) {
    await migrateSubcategoryMerge(database, 'prelievo-contante', 'contante')
  } else {
    await renameSubcategoryGuarded(database, 'prelievo-contante', 'contante', 'contante')
  }
}

const CATEGORY_RENAMES: ReadonlyArray<{ source: string; target: string; name: string }> = [
  { source: 'bollette-e-utilita', target: 'utenze', name: 'utenze' },
  { source: 'income-finanziari', target: 'rendite', name: 'rendite' },
  { source: 'tasse-imposte-e-commissioni', target: 'imposte-e-oneri', name: 'imposte e oneri' },
  { source: 'regali', target: 'regali-e-donazioni', name: 'regali e donazioni' },
  { source: 'ignore', target: 'trasferimenti', name: 'Trasferimenti' },
  { source: 'libri-e-media', target: 'cultura-e-tempo-libero', name: 'cultura e tempo libero' },
  { source: 'tempo-libero', target: 'cultura-e-tempo-libero', name: 'cultura e tempo libero' },
  { source: 'sconti-rimborsi-e-cashback', target: 'entrate-straordinarie', name: 'entrate straordinarie' },
  { source: 'rimborsi-cashback-e-bonus', target: 'entrate-straordinarie', name: 'entrate straordinarie' },
  { source: 'vendite-e-dismissioni', target: 'entrate-straordinarie', name: 'entrate straordinarie' },
]

const SUB_RENAMES: ReadonlyArray<{ source: string; target: string; name: string }> = [
  { source: 'carburante', target: 'carburante-e-ricarica', name: 'carburante e ricarica' },
  { source: 'take-away', target: 'take-away-e-delivery', name: 'take-away e delivery' },
  { source: 'sport', target: 'sport-e-fitness', name: 'sport e fitness' },
  { source: 'commissioni-bancarie', target: 'commissioni-e-canone-conto', name: 'commissioni e canone conto' },
  { source: 'bio-e-naturale', target: 'bio-vino-e-gourmet', name: 'bio vino e gourmet' },
  { source: 'spesa-bio', target: 'bio-vino-e-gourmet', name: 'bio vino e gourmet' },
  { source: 'pedaggi-autostradali', target: 'pedaggi-e-parcheggi', name: 'pedaggi e parcheggi' },
  { source: 'spese-telepass', target: 'pedaggi-e-parcheggi', name: 'pedaggi e parcheggi' },
  { source: 'ztl-e-parcheggi', target: 'pedaggi-e-parcheggi', name: 'pedaggi e parcheggi' },
  { source: 'manutenzione-ordinaria', target: 'manutenzione-casa', name: 'manutenzione casa' },
  { source: 'cene-fuori', target: 'ristoranti', name: 'ristoranti' },
  { source: 'pranzi', target: 'ristoranti', name: 'ristoranti' },
  { source: 'colazioni-e-snack', target: 'bar-caffe-e-snack', name: 'bar caffè e snack' },
  { source: 'abbigliamento', target: 'abbigliamento-e-accessori', name: 'abbigliamento e accessori' },
  { source: 'scarpe', target: 'abbigliamento-e-accessori', name: 'abbigliamento e accessori' },
  { source: 'accessori', target: 'abbigliamento-e-accessori', name: 'abbigliamento e accessori' },
  { source: 'attrezzatura-sportiva', target: 'attrezzatura-e-abbigliamento-sportivo', name: 'attrezzatura e abbigliamento sportivo' },
  { source: 'cinema', target: 'cinema-ed-eventi', name: 'cinema ed eventi' },
  { source: 'eventi', target: 'cinema-ed-eventi', name: 'cinema ed eventi' },
  { source: 'libri-cartacei', target: 'libri-e-audiolibri', name: 'libri e audiolibri' },
  { source: 'e-book', target: 'libri-e-audiolibri', name: 'libri e audiolibri' },
  { source: 'audiolibri', target: 'libri-e-audiolibri', name: 'libri e audiolibri' },
  { source: 'streaming-video', target: 'streaming', name: 'streaming' },
  { source: 'streaming-musica', target: 'streaming', name: 'streaming' },
  { source: 'cure-estetiche', target: 'cura-della-persona', name: 'cura della persona' },
  { source: 'massaggi', target: 'cura-della-persona', name: 'cura della persona' },
  { source: 'corsi-fitness', target: 'sport-e-fitness', name: 'sport e fitness' },
  { source: 'compleanni', target: 'regali', name: 'regali' },
  { source: 'festivita', target: 'regali', name: 'regali' },
  { source: 'anniversari', target: 'regali', name: 'regali' },
  { source: 'amici-e-conoscenti', target: 'regali', name: 'regali' },
  { source: 'fondo-pensione', target: 'previdenza-complementare', name: 'previdenza complementare' },
  { source: 'sconto-promozionale', target: 'bonus-promozionale', name: 'bonus promozionale' },
]

// Step 9: category and subcategory renames with idempotent guards
async function v2RenameCategoriesSubcategories(database: Db): Promise<void> {
  for (const { source, target, name } of CATEGORY_RENAMES) {
    await renameCategoryGuarded(database, source, target, name)
  }
  for (const { source, target, name } of SUB_RENAMES) {
    await renameSubcategoryGuarded(database, source, target, name)
  }
}

// Step 10: deactivate dissolved categories and pruned subcategories AFTER migrations
async function v2DeactivatePruned(database: Db): Promise<void> {
  const catResult = await database
    .update(category)
    .set({ isActive: false })
    .where(and(inArray(category.slug, [...DISSOLVED_CATEGORY_SLUGS]), isNull(category.userId)))
  console.log(
    `    deactivate dissolved categories: ${(catResult as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )

  const subResult = await database
    .update(subCategory)
    .set({ isActive: false })
    .where(and(inArray(subCategory.slug, [...DROPPED_SUBCATEGORY_SLUGS]), isNull(subCategory.userId)))
  console.log(
    `    deactivate dropped subcategories: ${(subResult as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )
}

function buildNatureSlugMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const entry of V2_SUBCATEGORY_MANIFEST) {
    if (!map[entry.natureCode]) map[entry.natureCode] = []
    map[entry.natureCode].push(entry.slug)
  }
  return map
}

const NATURE_SLUG_MAP = buildNatureSlugMap()

// Step 11: backfill nature_id via nature.code lookup (D-12)
async function v2BackfillNatureId(database: Db): Promise<void> {
  let totalUpdated = 0
  for (const [natureCode, slugs] of Object.entries(NATURE_SLUG_MAP)) {
    if (slugs.length === 0) continue
    const result = await database
      .update(subCategory)
      .set({
        natureId: sql`(SELECT id FROM ${nature} WHERE ${nature.code} = ${natureCode})`,
      })
      .where(and(inArray(subCategory.slug, slugs), isNull(subCategory.userId)))
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`    nature_id backfill code=${natureCode}: ${count} rows`)
    totalUpdated += count
  }
  console.log(`    nature_id backfill total: ${totalUpdated} rows`)
}

// Step 12: backfill user_subcategory_override.nature_id from linked system sub
async function v2BackfillOverrideNatureId(database: Db): Promise<void> {
  const result = await database.execute(sql`
    UPDATE user_subcategory_override uso
    SET nature_id = sc.nature_id
    FROM sub_category sc
    WHERE uso.sub_category_id = sc.id
      AND sc.user_id IS NULL
      AND uso.nature_id IS NULL
      AND sc.nature_id IS NOT NULL
  `)
  console.log(
    `    override nature_id backfill: ${(result as unknown as { rowCount?: number }).rowCount ?? 0} rows`,
  )
}

// Patterns discovered via `yarn regex:discover` (report 2026-06-15) and labeled manually.
// Global system patterns (userId null). Platform-ambiguous tokens are intentionally
// excluded — e.g. "deposit" means an internal transfer only on Crypto.com but could mean
// other things elsewhere, so it waits for per-platform pattern scoping.
async function insertRegexDiscovery20260615(database: Db): Promise<void> {
  const discovered: Array<{ slug: string; pattern: string; confidence: string; description: string }> = [
    { slug: 'pedaggi-e-parcheggi', pattern: '(?:\\badf\\b|\\bcdt\\b)', confidence: '0.80', description: 'Highway tolls (ADF, CDT)' },
    { slug: 'app-e-software', pattern: '(?:\\bclaude\\.ai\\b|\\bitunes)', confidence: '0.85', description: 'Software/app subscriptions (Claude.ai, Apple iTunes/App Store)' },
    { slug: 'ristoranti', pattern: '(?:\\bautogrill\\b|\\brestaurant\\b|\\bramen\\b|\\bpiadineria\\b|\\bbirreria\\b|\\bpinsa\\b|\\bbistrot\\b)', confidence: '0.80', description: 'Restaurants and food venue types' },
    { slug: 'manutenzione-auto', pattern: '(?:\\bautolavaggio\\b)', confidence: '0.90', description: 'Car wash' },
    { slug: 'casalinghi-e-non-alimentari', pattern: '(?:\\bferramenta\\b)', confidence: '0.85', description: 'Hardware store' },
    { slug: 'abbigliamento-e-accessori', pattern: '(?:\\bgeox\\b|\\bmarlboro\\b)', confidence: '0.85', description: 'Clothing/footwear (Geox, Marlboro Classics)' },
    { slug: 'spesa-quotidiana', pattern: '(?:\\bbilla\\b|\\bpastificio\\b)', confidence: '0.85', description: 'Grocery (Billa supermarket, pasta shop)' },
    { slug: 'alloggio', pattern: '(?:\\bhotel\\b)', confidence: '0.80', description: 'Hotels / lodging' },
    { slug: 'assicurazione-veicoli', pattern: '(?:\\bgenerali\\b)', confidence: '0.80', description: 'Generali vehicle insurance' },
  ]

  let inserted = 0
  for (const d of discovered) {
    const sub = await database
      .select({ id: subCategory.id })
      .from(subCategory)
      .where(and(eq(subCategory.slug, d.slug), isNull(subCategory.userId)))
      .limit(1)
    const subId = sub[0]?.id
    if (!subId) {
      console.log(`    regex-discovery: subcategory '${d.slug}' not found, skipped`)
      continue
    }
    const res = await database
      .insert(categorizationPattern)
      .values({
        userId: null,
        pattern: d.pattern,
        subCategoryId: subId,
        confidence: d.confidence,
        priority: 100,
        description: d.description,
      })
      .onConflictDoNothing()
    inserted += (res as unknown as { rowCount?: number }).rowCount ?? 0
  }
  console.log(`    regex-discovery 2026-06-15: ${inserted} pattern(s) inserted`)
}

// Patterns labeled from the Satispay export (report 2026-06-15). Satispay is a P2P payment
// app, so most rows are person-to-person transfers (un-patternable names) or Satispay-internal
// operations. Excluded on purpose: "ricarica" (wallet top-up — platform-ambiguous, collides
// with phone/fuel recharge elsewhere) and all person-name P2P clusters. "salvadanaio" is the
// Satispay savings feature → accantonamenti-obiettivi.
async function insertRegexDiscovery20260615Satispay(database: Db): Promise<void> {
  const discovered: Array<{ slug: string; pattern: string; confidence: string; description: string }> = [
    { slug: 'accantonamenti-obiettivi', pattern: '(?:\\bsalvadanaio\\b)', confidence: '0.85', description: 'Satispay salvadanaio (savings allocation)' },
    { slug: 'pedaggi-e-parcheggi', pattern: '(?:\\bfree flow\\b)', confidence: '0.85', description: 'Highway free-flow toll (e.g. A33)' },
    { slug: 'sport-e-fitness', pattern: '(?:\\bgpadel\\b)', confidence: '0.90', description: 'Padel court' },
    { slug: 'spesa-quotidiana', pattern: '(?:\\beataly\\b)', confidence: '0.90', description: 'Eataly grocery' },
    { slug: 'ristoranti', pattern: '(?:\\bbaita\\b)', confidence: '0.80', description: 'Mountain eatery (baita)' },
    { slug: 'bar-caffe-e-snack', pattern: '(?:\\bcaf[eèé])', confidence: '0.80', description: 'Cafe (single-f; complements the existing caff- pattern)' },
  ]

  let inserted = 0
  for (const d of discovered) {
    const sub = await database
      .select({ id: subCategory.id })
      .from(subCategory)
      .where(and(eq(subCategory.slug, d.slug), isNull(subCategory.userId)))
      .limit(1)
    const subId = sub[0]?.id
    if (!subId) {
      console.log(`    regex-discovery satispay: subcategory '${d.slug}' not found, skipped`)
      continue
    }
    const res = await database
      .insert(categorizationPattern)
      .values({
        userId: null,
        pattern: d.pattern,
        subCategoryId: subId,
        confidence: d.confidence,
        priority: 100,
        description: d.description,
      })
      .onConflictDoNothing()
    inserted += (res as unknown as { rowCount?: number }).rowCount ?? 0
  }
  console.log(`    regex-discovery 2026-06-15 satispay: ${inserted} pattern(s) inserted`)
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
  { name: 'v2-insert-categories-subcategories', run: v2InsertCategoriesSubcategories },
  { name: 'v2-migrate-merges-out', run: v2MigrateMergesOut },
  { name: 'v2-migrate-merges-in-allocation-transfer', run: v2MigrateMergesInAllocationTransfer },
  { name: 'v2-rename-categories-subcategories', run: v2RenameCategoriesSubcategories },
  { name: 'v2-deactivate-pruned', run: v2DeactivatePruned },
  { name: 'v2-backfill-nature-id', run: v2BackfillNatureId },
  { name: 'v2-backfill-override-nature-id', run: v2BackfillOverrideNatureId },
  { name: 'regex-discovery-2026-06-15', run: insertRegexDiscovery20260615 },
  { name: 'regex-discovery-2026-06-15-satispay', run: insertRegexDiscovery20260615Satispay },
]

export const STEP_NAMES = STEPS.map((step) => step.name)

// ---------------------------------------------------------------------------
// Runner (only when executed directly — tests import STEP_NAMES without DB)
// ---------------------------------------------------------------------------

const executedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])

async function runExtras(database: Db, target: string) {
  console.log(JSON.stringify({ event: 'seed_extras_started', target, steps: STEPS.length }))

  for (const step of STEPS) {
    console.log(`  [${step.name}] running...`)
    await step.run(database)
    console.log(`  [${step.name}] done`)
  }

  console.log(JSON.stringify({ event: 'seed_extras_succeeded', target }))
}

if (executedDirectly) {
  loadOperatorEnv()

  const seedTarget = resolveOperatorDatabaseTarget()
  const seedConfigResult = getOperatorDatabaseConfig({ target: seedTarget })

  if (!seedConfigResult.ok) {
    console.error(JSON.stringify({ event: 'seed_extras_failed', target: seedTarget, error: seedConfigResult.error }))
    process.exit(1)
  }

  const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

  console.log(
    JSON.stringify({
      event: 'seed_extras_connection',
      target: seedDiagnostics.target,
      host: seedDiagnostics.host,
    }),
  )

  if (isDirectSupabaseHost(seedDiagnostics.host)) {
    const hint = operatorConnectionFailureHint(seedDiagnostics.host, seedDiagnostics.target)
    if (hint) console.warn(JSON.stringify({ event: 'seed_extras_connection_warning', message: hint }))
  }

  const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
  const db = drizzle(pool)

  runExtras(db, seedDiagnostics.target)
    .catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'seed_extras_failed', error: String(error) }))
      process.exit(1)
    })
    .finally(() => pool.end())
}
