/**
 * V2 taxonomy manifest — sourced verbatim from .planning/nature-remapping-WORKING.md (D-01).
 * Single source of truth for seed-taxonomy contract tests (Wave 0 RED → Plan 02 GREEN).
 */

export type NatureCode =
  | 'income'
  | 'income_extraordinary'
  | 'essential'
  | 'discretionary'
  | 'debt'
  | 'transfer'
  | 'savings'
  | 'investment'

export type SubcategoryManifestEntry = {
  slug: string
  natureCode: NatureCode
}

/** Active v2 system category slugs: 4 IN + 16 OUT + 2 ALLOCATION + 1 TRANSFER */
export const V2_CATEGORY_SLUGS = [
  // IN (4)
  'income-da-lavoro',
  'pensioni-e-sussidi',
  'rendite',
  'entrate-straordinarie',
  // OUT (16)
  'trasporti',
  'spesa',
  'salute',
  'utenze',
  'casa',
  'imposte-e-oneri',
  'servizi-professionali',
  'formazione',
  'vacanze',
  'regali-e-donazioni',
  'ristorazione',
  'shopping',
  'cultura-e-tempo-libero',
  'benessere',
  'animali',
  'rate-e-finanziamenti',
  // ALLOCATION (2)
  'risparmio',
  'investimenti',
  // TRANSFER (1)
  'trasferimenti',
] as const

/** Final subcategory slugs with nature codes — working doc lines 59-159 */
export const V2_SUBCATEGORY_MANIFEST: SubcategoryManifestEntry[] = [
  // IN — Income da lavoro (7)
  { slug: 'stipendio-base', natureCode: 'income' },
  { slug: 'indennita', natureCode: 'income' },
  { slug: 'bonus', natureCode: 'income_extraordinary' },
  { slug: 'freelance', natureCode: 'income_extraordinary' },
  { slug: 'consulenze', natureCode: 'income_extraordinary' },
  { slug: 'progetti-occasionali', natureCode: 'income_extraordinary' },
  { slug: 'commissioni', natureCode: 'income_extraordinary' },
  // IN — Pensioni e sussidi (2)
  { slug: 'pensione', natureCode: 'income' },
  { slug: 'sussidi-statali', natureCode: 'income' },
  // IN — Rendite (3)
  { slug: 'dividendi', natureCode: 'income' },
  { slug: 'interessi-attivi', natureCode: 'income' },
  { slug: 'canone-di-locazione', natureCode: 'income' },
  // IN — Entrate straordinarie (4)
  { slug: 'cashback', natureCode: 'income_extraordinary' },
  { slug: 'bonus-promozionale', natureCode: 'income_extraordinary' },
  { slug: 'vendita-beni-usati', natureCode: 'income_extraordinary' },
  { slug: 'eredita-e-donazioni', natureCode: 'income_extraordinary' },
  // OUT — Trasporti (6)
  { slug: 'carburante-e-ricarica', natureCode: 'essential' },
  { slug: 'manutenzione-auto', natureCode: 'essential' },
  { slug: 'mezzi-pubblici', natureCode: 'essential' },
  { slug: 'taxi-e-ride-sharing', natureCode: 'essential' },
  { slug: 'pedaggi-e-parcheggi', natureCode: 'essential' },
  { slug: 'assicurazione-veicoli', natureCode: 'essential' },
  // OUT - Groceries (3)
  { slug: 'spesa-quotidiana', natureCode: 'essential' },
  { slug: 'casalinghi-e-non-alimentari', natureCode: 'essential' },
  { slug: 'bio-vino-e-gourmet', natureCode: 'discretionary' },
  // OUT - Health (4)
  { slug: 'visite-mediche', natureCode: 'essential' },
  { slug: 'trattamenti-medici', natureCode: 'essential' },
  { slug: 'farmaci', natureCode: 'essential' },
  { slug: 'assicurazione-salute', natureCode: 'discretionary' },
  // OUT — Utenze (5)
  { slug: 'energia-elettrica', natureCode: 'essential' },
  { slug: 'gas', natureCode: 'essential' },
  { slug: 'acqua', natureCode: 'essential' },
  { slug: 'rifiuti', natureCode: 'essential' },
  { slug: 'telefono-e-internet', natureCode: 'essential' },
  // OUT — Casa (5)
  { slug: 'affitto', natureCode: 'essential' },
  { slug: 'spese-condominiali', natureCode: 'essential' },
  { slug: 'manutenzione-casa', natureCode: 'essential' },
  { slug: 'servizi-domestici', natureCode: 'essential' },
  { slug: 'assicurazione-casa', natureCode: 'essential' },
  // OUT — Imposte e oneri (4)
  { slug: 'imposte', natureCode: 'essential' },
  { slug: 'bolli-auto', natureCode: 'essential' },
  { slug: 'multe-e-sanzioni', natureCode: 'essential' },
  { slug: 'commissioni-e-canone-conto', natureCode: 'essential' },
  // OUT — Servizi professionali (1)
  { slug: 'spese-legali-notarili', natureCode: 'essential' },
  // OUT — Formazione (3)
  { slug: 'universita', natureCode: 'essential' },
  { slug: 'spese-scolastiche', natureCode: 'essential' },
  { slug: 'corsi', natureCode: 'discretionary' },
  // OUT — Vacanze (5)
  { slug: 'alloggio', natureCode: 'discretionary' },
  { slug: 'trasporto', natureCode: 'discretionary' },
  { slug: 'attivita-e-intrattenimento', natureCode: 'discretionary' },
  { slug: 'cibo-e-bevande', natureCode: 'discretionary' },
  { slug: 'assicurazione-viaggio', natureCode: 'discretionary' },
  // OUT — Regali e donazioni (2)
  { slug: 'regali', natureCode: 'discretionary' },
  { slug: 'donazioni-beneficenza', natureCode: 'discretionary' },
  // OUT — Ristorazione (3)
  { slug: 'ristoranti', natureCode: 'discretionary' },
  { slug: 'bar-caffe-e-snack', natureCode: 'discretionary' },
  { slug: 'take-away-e-delivery', natureCode: 'discretionary' },
  // OUT — Shopping (4)
  { slug: 'elettronica', natureCode: 'discretionary' },
  { slug: 'abbigliamento-e-accessori', natureCode: 'discretionary' },
  { slug: 'prodotti-per-la-casa', natureCode: 'discretionary' },
  { slug: 'giocattoli', natureCode: 'discretionary' },
  // OUT — Cultura e tempo libero (5)
  { slug: 'cinema-ed-eventi', natureCode: 'discretionary' },
  { slug: 'libri-e-audiolibri', natureCode: 'discretionary' },
  { slug: 'streaming', natureCode: 'discretionary' },
  { slug: 'app-e-software', natureCode: 'discretionary' },
  { slug: 'videogiochi', natureCode: 'discretionary' },
  // OUT — Benessere (4)
  { slug: 'sport-e-fitness', natureCode: 'discretionary' },
  { slug: 'attrezzatura-e-abbigliamento-sportivo', natureCode: 'discretionary' },
  { slug: 'cura-della-persona', natureCode: 'discretionary' },
  { slug: 'psicologia', natureCode: 'discretionary' },
  // OUT — Animali (2)
  { slug: 'cura-animali', natureCode: 'discretionary' },
  { slug: 'assicurazione-animali', natureCode: 'discretionary' },
  // OUT — Rate e finanziamenti (3)
  { slug: 'mutuo-casa', natureCode: 'debt' },
  { slug: 'finanziamenti-auto', natureCode: 'debt' },
  { slug: 'altri-finanziamenti', natureCode: 'debt' },
  // ALLOCATION — Risparmio (3)
  { slug: 'conto-risparmio', natureCode: 'savings' },
  { slug: 'fondo-emergenze', natureCode: 'savings' },
  { slug: 'accantonamenti-obiettivi', natureCode: 'savings' },
  // ALLOCATION — Investimenti (6)
  { slug: 'titoli-e-fondi', natureCode: 'investment' },
  { slug: 'criptovalute', natureCode: 'investment' },
  { slug: 'immobili', natureCode: 'investment' },
  { slug: 'previdenza-complementare', natureCode: 'investment' },
  { slug: 'polizze-vita', natureCode: 'investment' },
  { slug: 'oro-e-beni-rifugio', natureCode: 'investment' },
  // TRANSFER — Trasferimenti (3)
  { slug: 'trasferimento-tra-conti', natureCode: 'transfer' },
  { slug: 'addebito-carta-di-credito', natureCode: 'transfer' },
  { slug: 'contante', natureCode: 'transfer' },
]

/** V1 wrapper categories dissolved in v2 (D-02) — must not appear in active set */
export const DISSOLVED_CATEGORY_SLUGS = [
  'abbonamenti',
  'assicurazioni',
  'famiglia',
  'libri-e-media',
  'tempo-libero',
  'sconti-rimborsi-e-cashback',
  'vendite-e-dismissioni',
  'movimenti-di-liquidita',
  'bonifici-e-rimborsi',
] as const

/** Pruned subcategory slugs — deactivated or folded into merges (D-03) */
export const DROPPED_SUBCATEGORY_SLUGS = [
  'overtime',
  // rimborso-* variants (net under original expense)
  'rimborso-spese-lavorative',
  'rimborso-spese-sanitarie',
  'rimborso-spese-viaggi',
  'rimborso-ordine-online',
  'rimborsi',
  // merged cashback / sconto variants
  'cashback-carta-di-credito',
  'cashback-acquisti-online',
  'cashback-programmi-fedelta',
  'sconto-abbonamento',
  'sconto-promozionale',
  'sconto-canone',
  // step-4 historical orphans (not in v2 manifest — merge then deactivate)
  'rimborso-abbonamento-e-canoni',
  'rimborso-da-persona',
  'rimborsi-cashback-e-bonus', // renamed by step 4; step 8 merge target is a category not sub — deactivate via step 10
  // moved to allocation or merged
  'vendita-di-beni-usati',
  'commercio-online',
  'immobili-vendita',
  'vendita-investimenti',
  // folded into trasferimento-tra-conti
  'bonifico-in-entrata',
  'bonifico-in-uscita',
  'ricariche-conti',
  'trasferimento',
  // wrapper / store-type splits
  'altri-abbonamenti',
  'spesa-online',
  'discount',
  'negozio-di-quartiere',
  'mercato-rionale',
  'prodotti-freschi',
  'prodotti-non-alimentari',
  // other pruned OUT subs
  'treno',
  'ristrutturazione', // casa — not in v2 remap; no expenses/patterns; deactivated via v2-deactivate-pruned
] as const

/** Maps nature codes to seed-data natures array IDs (Phase 46 — do not modify) */
export const NATURE_ID_BY_CODE: Record<NatureCode, number> = {
  income: 1,
  income_extraordinary: 2,
  essential: 3,
  discretionary: 4,
  debt: 5,
  transfer: 6,
  savings: 7,
  investment: 8,
}
