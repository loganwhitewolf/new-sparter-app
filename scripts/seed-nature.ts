// Sets FlowNature on system subcategories. Idempotent — safe to run multiple times.
// Usage mirrors yarn db:seed:
//   yarn db:seed-nature              → DATABASE_URL
//   yarn db:seed-nature:staging      → STAGING_DATABASE_URL
//   yarn db:seed-nature:production   → PRODUCTION_DATABASE_URL + PRODUCTION_MIGRATION_CONFIRM
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { inArray } from 'drizzle-orm'
import { subCategory } from '../lib/db/schema'
import type { FlowNature } from '../lib/utils/nature-labels'
import {
  getOperatorDatabaseConfig,
  loadOperatorEnv,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
} from './db-config'

loadOperatorEnv()

const seedTarget = resolveOperatorDatabaseTarget()
const seedConfigResult = getOperatorDatabaseConfig({ target: seedTarget })

if (!seedConfigResult.ok) {
  console.error(JSON.stringify({ event: 'seed_nature_failed', target: seedTarget, error: seedConfigResult.error }))
  process.exit(1)
}

const { config: seedConfig, diagnostics: seedDiagnostics } = seedConfigResult

console.log(JSON.stringify({
  event: 'seed_nature_connection',
  target: seedDiagnostics.target,
  host: seedDiagnostics.host,
}))

const pool = new Pool(pgPoolConfigFromOperatorConfig(seedConfig))
const db = drizzle(pool)

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
  financial: [
    'azioni',
    'obbligazioni',
    'criptovalute',
    'fondi-comuni',
    'immobili',
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

// trasferimento and addebito-carta-di-credito are intentionally null (no UPDATE needed)

async function seedNature() {
  console.log(JSON.stringify({ event: 'seed_nature_started', target: seedDiagnostics.target }))

  let totalUpdated = 0

  for (const [nature, slugs] of Object.entries(NATURE_SLUGS) as [FlowNature, string[]][]) {
    if (slugs.length === 0) continue
    const result = await db
      .update(subCategory)
      .set({ nature })
      .where(inArray(subCategory.slug, slugs))
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0
    console.log(`  nature=${nature}: ${count} rows updated (${slugs.length} slugs targeted)`)
    totalUpdated += count
  }

  console.log(JSON.stringify({ event: 'seed_nature_succeeded', target: seedDiagnostics.target, totalUpdated }))
}

seedNature()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: 'seed_nature_failed', error: String(error) }))
    process.exit(1)
  })
  .finally(() => pool.end())
