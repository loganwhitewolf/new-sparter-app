// Additive seed steps — runs after yarn db:seed. Each step is idempotent.
// Add new steps to the STEPS array; existing steps are re-run safely.
// Usage mirrors yarn db:seed:
//   yarn db:seed-extras              → DATABASE_URL
//   yarn db:seed-extras:staging      → STAGING_DATABASE_URL
//   yarn db:seed-extras:production   → PRODUCTION_DATABASE_URL + PRODUCTION_MIGRATION_CONFIRM
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, inArray } from 'drizzle-orm'
import { platform, subCategory } from '../lib/db/schema'
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

// ---------------------------------------------------------------------------
// Registry — append new steps here
// ---------------------------------------------------------------------------

const STEPS: Array<{ name: string; run: (database: Db) => Promise<void> }> = [
  { name: 'set-subcategory-nature', run: setSubcategoryNature },
  { name: 'set-fineco-description-strip-pattern', run: setFinecoDescriptionStripPattern },
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
