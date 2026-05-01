// Run with: npm run db:seed
// Ports all data from docs/init/seed.ts to the Drizzle schema.
// Uses onConflictDoNothing() — safe to run multiple times (idempotent).
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { existsSync } from 'node:fs'
import { category, subCategory, platform, importFormatVersion, categorizationPattern } from '../lib/db/schema'
import { platforms as seedPlatforms, categorizationPatterns as seedCategorizationPatterns } from '../docs/init/seed'

// Load local env before anything else (same pattern as scripts/migrate.ts)
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile?.(envFile)
  }
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trovato. Controlla .env.local o .env')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

// ---------------------------------------------------------------------------
// CATEGORIES — ported from docs/init/seed.ts (26 categorie di sistema)
// ---------------------------------------------------------------------------
const categories = [
  // OUT
  { id: 1, name: 'risparmio', slug: 'risparmio', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 2, name: 'abbonamenti', slug: 'abbonamenti', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 3, name: 'assicurazioni', slug: 'assicurazioni', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 4, name: 'vacanze', slug: 'vacanze', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 5, name: 'regali', slug: 'regali', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 7, name: 'trasporti', slug: 'trasporti', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 8, name: 'spesa', slug: 'spesa', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 9, name: 'salute', slug: 'salute', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 10, name: 'ristorazione', slug: 'ristorazione', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 11, name: 'shopping', slug: 'shopping', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 12, name: 'investimenti', slug: 'investimenti', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 13, name: 'bollette e utilità', slug: 'bollette-e-utilita', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 14, name: 'rate e finanziamenti', slug: 'rate-e-finanziamenti', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 15, name: 'tasse, imposte e commissioni', slug: 'tasse-imposte-e-commissioni', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 18, name: 'famiglia', slug: 'famiglia', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 19, name: 'casa', slug: 'casa', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 21, name: 'formazione', slug: 'formazione', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 22, name: 'libri e media', slug: 'libri-e-media', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 23, name: 'tempo libero', slug: 'tempo-libero', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 33, name: 'benessere', slug: 'benessere', type: 'out' as const, displayOrder: 0, isActive: true },
  { id: 34, name: 'bonifici e rimborsi', slug: 'bonifici-e-rimborsi', type: 'out' as const, displayOrder: 0, isActive: true },
  // IN
  { id: 24, name: 'income da lavoro', slug: 'income-da-lavoro', type: 'in' as const, displayOrder: 0, isActive: true },
  { id: 25, name: 'income finanziari', slug: 'income-finanziari', type: 'in' as const, displayOrder: 0, isActive: true },
  { id: 26, name: 'sconti, rimborsi e cashback', slug: 'sconti-rimborsi-e-cashback', type: 'in' as const, displayOrder: 0, isActive: true },
  { id: 27, name: 'vendite e dismissioni', slug: 'vendite-e-dismissioni', type: 'in' as const, displayOrder: 0, isActive: true },
  { id: 28, name: 'movimenti di liquidità', slug: 'movimenti-di-liquidita', type: 'in' as const, displayOrder: 0, isActive: true },
  // SYSTEM
  { id: 32, name: 'ignore', slug: 'ignore', type: 'system' as const, displayOrder: 0, isActive: true },
]

// ---------------------------------------------------------------------------
// SUBCATEGORIES — ported from docs/init/seed.ts (~120 sottocategorie)
// Insert AFTER categories to respect FK constraint (Pitfall 5)
// ---------------------------------------------------------------------------
const subCategories = [
  // Risparmio (1)
  { categoryId: 1, name: 'conto risparmio', slug: 'conto-risparmio', displayOrder: 0, isActive: true },
  { categoryId: 1, name: 'fondo emergenze', slug: 'fondo-emergenze', displayOrder: 0, isActive: true },
  { categoryId: 1, name: 'fondo pensione', slug: 'fondo-pensione', displayOrder: 0, isActive: true },
  { categoryId: 1, name: 'risparmio per progetti', slug: 'risparmio-per-progetti', displayOrder: 0, isActive: true },
  { categoryId: 1, name: 'risparmio per investimenti', slug: 'risparmio-per-investimenti', displayOrder: 0, isActive: true },
  { categoryId: 1, name: 'obiettivi a lungo termine', slug: 'obiettivi-a-lungo-termine', displayOrder: 0, isActive: true },
  { categoryId: 1, name: 'risparmio per salute', slug: 'risparmio-per-salute', displayOrder: 0, isActive: true },
  // Abbonamenti (2)
  { categoryId: 2, name: 'altri abbonamenti', slug: 'altri-abbonamenti', displayOrder: 0, isActive: true },
  { categoryId: 2, name: 'streaming video', slug: 'streaming-video', displayOrder: 0, isActive: true },
  { categoryId: 2, name: 'streaming musica', slug: 'streaming-musica', displayOrder: 0, isActive: true },
  { categoryId: 2, name: 'software e app', slug: 'software-e-app', displayOrder: 0, isActive: true },
  { categoryId: 2, name: 'servizi telefonici e internet', slug: 'servizi-telefonici-e-internet', displayOrder: 0, isActive: true },
  { categoryId: 2, name: 'piattaforme didattiche', slug: 'piattaforme-didattiche', displayOrder: 0, isActive: true },
  { categoryId: 2, name: 'banca', slug: 'banca', displayOrder: 0, isActive: true },
  // Assicurazioni (3)
  { categoryId: 3, name: 'auto', slug: 'auto', displayOrder: 0, isActive: true },
  { categoryId: 3, name: 'casa', slug: 'casa', displayOrder: 0, isActive: true },
  { categoryId: 3, name: 'salute', slug: 'salute', displayOrder: 0, isActive: true },
  { categoryId: 3, name: 'viaggio', slug: 'viaggio', displayOrder: 0, isActive: true },
  { categoryId: 3, name: 'responsabilità civile', slug: 'responsabilita-civile', displayOrder: 0, isActive: true },
  { categoryId: 3, name: 'animali domestici', slug: 'animali-domestici', displayOrder: 0, isActive: true },
  // Vacanze (4)
  { categoryId: 4, name: 'alloggio', slug: 'alloggio', displayOrder: 0, isActive: true },
  { categoryId: 4, name: 'trasporto', slug: 'trasporto', displayOrder: 0, isActive: true },
  { categoryId: 4, name: 'attività e intrattenimento', slug: 'attivita-e-intrattenimento', displayOrder: 0, isActive: true },
  { categoryId: 4, name: 'cibo e bevande', slug: 'cibo-e-bevande', displayOrder: 0, isActive: true },
  { categoryId: 4, name: 'assicurazione viaggio', slug: 'assicurazione-viaggio', displayOrder: 0, isActive: true },
  // Regali (5)
  { categoryId: 5, name: 'compleanni', slug: 'compleanni', displayOrder: 0, isActive: true },
  { categoryId: 5, name: 'festività', slug: 'festivita', displayOrder: 0, isActive: true },
  { categoryId: 5, name: 'anniversari', slug: 'anniversari', displayOrder: 0, isActive: true },
  { categoryId: 5, name: 'amici e conoscenti', slug: 'amici-e-conoscenti', displayOrder: 0, isActive: true },
  // Trasporti (7)
  { categoryId: 7, name: 'carburante', slug: 'carburante', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'elettricità per auto', slug: 'elettricita-per-auto', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'mezzi pubblici', slug: 'mezzi-pubblici', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'taxi e ride sharing', slug: 'taxi-e-ride-sharing', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'treno', slug: 'treno', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'pedaggi autostradali', slug: 'pedaggi-autostradali', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'spese telepass', slug: 'spese-telepass', displayOrder: 0, isActive: true },
  { categoryId: 7, name: 'ztl e parcheggi', slug: 'ztl-e-parcheggi', displayOrder: 0, isActive: true },
  // Spesa (8)
  { categoryId: 8, name: 'supermercato', slug: 'supermercato', displayOrder: 0, isActive: true },
  { categoryId: 8, name: 'spesa online', slug: 'spesa-online', displayOrder: 0, isActive: true },
  { categoryId: 8, name: 'prodotti freschi', slug: 'prodotti-freschi', displayOrder: 0, isActive: true },
  { categoryId: 8, name: 'prodotti non alimentari', slug: 'prodotti-non-alimentari', displayOrder: 0, isActive: true },
  { categoryId: 8, name: 'spesa bio', slug: 'spesa-bio', displayOrder: 0, isActive: true },
  // Salute (9)
  { categoryId: 9, name: 'visite mediche', slug: 'visite-mediche', displayOrder: 0, isActive: true },
  { categoryId: 9, name: 'farmaci e medicinali', slug: 'farmaci-e-medicinali', displayOrder: 0, isActive: true },
  { categoryId: 9, name: 'trattamenti medici', slug: 'trattamenti-medici', displayOrder: 0, isActive: true },
  { categoryId: 9, name: 'farmaci generici', slug: 'farmaci-generici', displayOrder: 0, isActive: true },
  { categoryId: 9, name: 'parafarmaceutici', slug: 'parafarmaceutici', displayOrder: 0, isActive: true },
  // Ristorazione (10)
  { categoryId: 10, name: 'cene fuori', slug: 'cene-fuori', displayOrder: 0, isActive: true },
  { categoryId: 10, name: 'pranzi', slug: 'pranzi', displayOrder: 0, isActive: true },
  { categoryId: 10, name: 'colazioni e snack', slug: 'colazioni-e-snack', displayOrder: 0, isActive: true },
  { categoryId: 10, name: 'take-away', slug: 'take-away', displayOrder: 0, isActive: true },
  // Shopping (11)
  { categoryId: 11, name: 'elettronica', slug: 'elettronica', displayOrder: 0, isActive: true },
  { categoryId: 11, name: 'abbigliamento', slug: 'abbigliamento', displayOrder: 0, isActive: true },
  { categoryId: 11, name: 'prodotti per la casa', slug: 'prodotti-per-la-casa', displayOrder: 0, isActive: true },
  { categoryId: 11, name: 'giocattoli', slug: 'giocattoli', displayOrder: 0, isActive: true },
  { categoryId: 11, name: 'scarpe', slug: 'scarpe', displayOrder: 0, isActive: true },
  { categoryId: 11, name: 'accessori', slug: 'accessori', displayOrder: 0, isActive: true },
  { categoryId: 11, name: 'attrezzatura sportiva', slug: 'attrezzatura-sportiva', displayOrder: 0, isActive: true },
  // Investimenti (12)
  { categoryId: 12, name: 'azioni', slug: 'azioni', displayOrder: 0, isActive: true },
  { categoryId: 12, name: 'obbligazioni', slug: 'obbligazioni', displayOrder: 0, isActive: true },
  { categoryId: 12, name: 'criptovalute', slug: 'criptovalute', displayOrder: 0, isActive: true },
  { categoryId: 12, name: 'fondi comuni', slug: 'fondi-comuni', displayOrder: 0, isActive: true },
  { categoryId: 12, name: 'immobili', slug: 'immobili', displayOrder: 0, isActive: true },
  // Bollette e utilità (13)
  { categoryId: 13, name: 'energia elettrica', slug: 'energia-elettrica', displayOrder: 0, isActive: true },
  { categoryId: 13, name: 'gas', slug: 'gas', displayOrder: 0, isActive: true },
  { categoryId: 13, name: 'acqua', slug: 'acqua', displayOrder: 0, isActive: true },
  { categoryId: 13, name: 'rifiuti', slug: 'rifiuti', displayOrder: 0, isActive: true },
  // Rate e finanziamenti (14)
  { categoryId: 14, name: 'mutuo casa', slug: 'mutuo-casa', displayOrder: 0, isActive: true },
  { categoryId: 14, name: 'finanziamenti auto', slug: 'finanziamenti-auto', displayOrder: 0, isActive: true },
  { categoryId: 14, name: 'altri finanziamenti', slug: 'altri-finanziamenti', displayOrder: 0, isActive: true },
  // Tasse, imposte e commissioni (15)
  { categoryId: 15, name: 'imposte', slug: 'imposte', displayOrder: 0, isActive: true },
  { categoryId: 15, name: 'imposte governative', slug: 'imposte-governative', displayOrder: 0, isActive: true },
  { categoryId: 15, name: 'bolli auto', slug: 'bolli-auto', displayOrder: 0, isActive: true },
  { categoryId: 15, name: 'commissioni bancarie', slug: 'commissioni-bancarie', displayOrder: 0, isActive: true },
  // Famiglia (18)
  { categoryId: 18, name: 'spese scolastiche', slug: 'spese-scolastiche', displayOrder: 0, isActive: true },
  { categoryId: 18, name: 'attività extra-scolastiche', slug: 'attivita-extra-scolastiche', displayOrder: 0, isActive: true },
  { categoryId: 18, name: 'baby-sitter', slug: 'baby-sitter', displayOrder: 0, isActive: true },
  // Casa (19)
  { categoryId: 19, name: 'manutenzione ordinaria', slug: 'manutenzione-ordinaria', displayOrder: 0, isActive: true },
  { categoryId: 19, name: 'ristrutturazione', slug: 'ristrutturazione', displayOrder: 0, isActive: true },
  { categoryId: 19, name: 'affitto', slug: 'affitto', displayOrder: 0, isActive: true },
  { categoryId: 19, name: 'badante', slug: 'badante', displayOrder: 0, isActive: true },
  { categoryId: 19, name: 'servizi di pulizia', slug: 'servizi-di-pulizia', displayOrder: 0, isActive: true },
  // Formazione (21)
  { categoryId: 21, name: 'corsi online', slug: 'corsi-online', displayOrder: 0, isActive: true },
  { categoryId: 21, name: 'università', slug: 'universita', displayOrder: 0, isActive: true },
  { categoryId: 21, name: 'corsi di specializzazione', slug: 'corsi-di-specializzazione', displayOrder: 0, isActive: true },
  // Libri e media (22)
  { categoryId: 22, name: 'libri cartacei', slug: 'libri-cartacei', displayOrder: 0, isActive: true },
  { categoryId: 22, name: 'e-book', slug: 'e-book', displayOrder: 0, isActive: true },
  { categoryId: 22, name: 'audiolibri', slug: 'audiolibri', displayOrder: 0, isActive: true },
  // Tempo libero (23)
  { categoryId: 23, name: 'cinema', slug: 'cinema', displayOrder: 0, isActive: true },
  { categoryId: 23, name: 'eventi', slug: 'eventi', displayOrder: 0, isActive: true },
  // Income da lavoro (24)
  { categoryId: 24, name: 'stipendio base', slug: 'stipendio-base', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'bonus', slug: 'bonus', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'indennità', slug: 'indennita', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'overtime', slug: 'overtime', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'freelance', slug: 'freelance', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'consulenze', slug: 'consulenze', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'progetti occasionali', slug: 'progetti-occasionali', displayOrder: 0, isActive: true },
  { categoryId: 24, name: 'commissioni', slug: 'commissioni', displayOrder: 0, isActive: true },
  // Income finanziari (25)
  { categoryId: 25, name: 'dividendi azionari', slug: 'dividendi-azionari', displayOrder: 0, isActive: true },
  { categoryId: 25, name: 'dividendi fondi comuni', slug: 'dividendi-fondi-comuni', displayOrder: 0, isActive: true },
  { categoryId: 25, name: 'dividendi immobiliari', slug: 'dividendi-immobiliari', displayOrder: 0, isActive: true },
  // Sconti, rimborsi e cashback (26)
  { categoryId: 26, name: 'rimborso spese lavorative', slug: 'rimborso-spese-lavorative', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'rimborso spese sanitarie', slug: 'rimborso-spese-sanitarie', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'rimborso spese viaggi', slug: 'rimborso-spese-viaggi', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'rimborso ordine online', slug: 'rimborso-ordine-online', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'cashback carta di credito', slug: 'cashback-carta-di-credito', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'cashback acquisti online', slug: 'cashback-acquisti-online', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'cashback programmi fedeltà', slug: 'cashback-programmi-fedelta', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'sconto abbonamento', slug: 'sconto-abbonamento', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'sconto promozionale', slug: 'sconto-promozionale', displayOrder: 0, isActive: true },
  { categoryId: 26, name: 'sconto canone', slug: 'sconto-canone', displayOrder: 0, isActive: true },
  // Vendite e dismissioni (27)
  { categoryId: 27, name: 'vendita di beni usati', slug: 'vendita-di-beni-usati', displayOrder: 0, isActive: true },
  { categoryId: 27, name: 'commercio online', slug: 'commercio-online', displayOrder: 0, isActive: true },
  { categoryId: 27, name: 'immobili', slug: 'immobili-vendita', displayOrder: 0, isActive: true },
  { categoryId: 27, name: 'vendita investimenti', slug: 'vendita-investimenti', displayOrder: 0, isActive: true },
  // Movimenti di liquidità (28)
  { categoryId: 28, name: 'bonifico in entrata', slug: 'bonifico-in-entrata', displayOrder: 0, isActive: true },
  { categoryId: 28, name: 'ricariche conti', slug: 'ricariche-conti', displayOrder: 0, isActive: true },
  // Ignore (32)
  { categoryId: 32, name: 'trasferimento', slug: 'trasferimento', displayOrder: 0, isActive: true },
  { categoryId: 32, name: 'addebito carta di credito', slug: 'addebito-carta-di-credito', displayOrder: 0, isActive: true },
  // Benessere (33)
  { categoryId: 33, name: 'cure estetiche', slug: 'cure-estetiche', displayOrder: 0, isActive: true },
  { categoryId: 33, name: 'sport', slug: 'sport', displayOrder: 0, isActive: true },
  { categoryId: 33, name: 'psicologia', slug: 'psicologia', displayOrder: 0, isActive: true },
  { categoryId: 33, name: 'massaggi', slug: 'massaggi', displayOrder: 0, isActive: true },
  { categoryId: 33, name: 'corsi fitness', slug: 'corsi-fitness', displayOrder: 0, isActive: true },
  // Bonifici e rimborsi (34)
  { categoryId: 34, name: 'bonifico in uscita', slug: 'bonifico-in-uscita', displayOrder: 0, isActive: true },
  { categoryId: 34, name: 'rimborsi', slug: 'rimborsi', displayOrder: 0, isActive: true },
]

function headerSignatureFor(platformSeed: (typeof seedPlatforms)[number]) {
  const columns = [
    platformSeed.timestampColumn,
    platformSeed.descriptionColumn,
    platformSeed.amountColumn,
    platformSeed.positiveAmountColumn,
    platformSeed.negativeAmountColumn,
  ].filter((column): column is string => Boolean(column))

  return columns.join(platformSeed.delimiter)
}

async function seed() {
  console.log('Seeding categories...')
  await db.insert(category).values(categories).onConflictDoNothing()
  console.log(`  ${categories.length} categorie inserite (o già presenti).`)

  console.log('Seeding subcategories...')
  // Insert subCategories AFTER categories (FK constraint — Pitfall 5)
  await db.insert(subCategory).values(subCategories).onConflictDoNothing()
  console.log(`  ${subCategories.length} sottocategorie inserite (o già presenti).`)

  console.log('Seeding import platforms...')
  await db
    .insert(platform)
    .values(seedPlatforms.map((platformSeed) => ({ ...platformSeed, isActive: true })))
    .onConflictDoNothing()
  console.log(`  ${seedPlatforms.length} piattaforme inserite (o già presenti).`)

  console.log('Seeding import format versions...')
  await db
    .insert(importFormatVersion)
    .values(
      seedPlatforms.map((platformSeed) => ({
        platformId: platformSeed.id,
        version: 1,
        headerSignature: headerSignatureFor(platformSeed),
        notes: `Initial ${platformSeed.name} CSV import contract`,
        isActive: true,
      })),
    )
    .onConflictDoNothing()
  console.log(`  ${seedPlatforms.length} versioni formato inserite (o già presenti).`)

  console.log('Seeding system categorization patterns...')
  const seededSubCategories = await db.select({ id: subCategory.id, slug: subCategory.slug }).from(subCategory)
  const subCategoryIdBySlug = new Map(seededSubCategories.map((row) => [row.slug, row.id]))
  const missingSlugs = Array.from(
    new Set(
      seedCategorizationPatterns
        .map((patternSeed) => patternSeed.subCategorySlug)
        .filter((slug) => !subCategoryIdBySlug.has(slug)),
    ),
  )

  if (missingSlugs.length > 0) {
    throw new Error(
      `Missing subcategory slugs for system categorization patterns: ${missingSlugs.join(', ')}`,
    )
  }

  await db
    .insert(categorizationPattern)
    .values(
      seedCategorizationPatterns.map((patternSeed) => ({
        userId: null,
        pattern: patternSeed.pattern,
        subCategoryId: subCategoryIdBySlug.get(patternSeed.subCategorySlug)!,
        amountSign: patternSeed.amountSign,
        confidence: patternSeed.confidence.toFixed(2),
        priority: patternSeed.priority,
        description: patternSeed.description,
        isActive: true,
      })),
    )
    .onConflictDoNothing()
  console.log(`  ${seedCategorizationPatterns.length} pattern sistema inseriti (o già presenti).`)

  console.log('Seed completato.')
}

seed().catch(console.error).finally(() => pool.end())
