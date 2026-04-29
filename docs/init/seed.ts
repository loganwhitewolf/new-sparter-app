/**
 * Seed data per il nuovo progetto Next.js + Drizzle.
 * Copia questo file in drizzle/seed.ts e adattalo alle definizioni dello schema Drizzle.
 *
 * Contiene:
 * - categories (26 categorie sistema)
 * - subCategories (~120 sottocategorie)
 * - platforms (6 piattaforme bancarie)
 * - categorizationPatterns (28 pattern regex sistema)
 */

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

export const categories = [
  // OUT
  { id: 1, name: "risparmio", slug: "risparmio", type: "out" as const },
  { id: 2, name: "abbonamenti", slug: "abbonamenti", type: "out" as const },
  { id: 3, name: "assicurazioni", slug: "assicurazioni", type: "out" as const },
  { id: 4, name: "vacanze", slug: "vacanze", type: "out" as const },
  { id: 5, name: "regali", slug: "regali", type: "out" as const },
  { id: 7, name: "trasporti", slug: "trasporti", type: "out" as const },
  { id: 8, name: "spesa", slug: "spesa", type: "out" as const },
  { id: 9, name: "salute", slug: "salute", type: "out" as const },
  { id: 10, name: "ristorazione", slug: "ristorazione", type: "out" as const },
  { id: 11, name: "shopping", slug: "shopping", type: "out" as const },
  { id: 12, name: "investimenti", slug: "investimenti", type: "out" as const }, // categoria OUT mantenuta anche senza modulo investimenti
  {
    id: 13,
    name: "bollette e utilità",
    slug: "bollette-e-utilita",
    type: "out" as const,
  },
  {
    id: 14,
    name: "rate e finanziamenti",
    slug: "rate-e-finanziamenti",
    type: "out" as const,
  },
  {
    id: 15,
    name: "tasse, imposte e commissioni",
    slug: "tasse-imposte-e-commissioni",
    type: "out" as const,
  },
  { id: 18, name: "famiglia", slug: "famiglia", type: "out" as const },
  { id: 19, name: "casa", slug: "casa", type: "out" as const },
  { id: 21, name: "formazione", slug: "formazione", type: "out" as const },
  {
    id: 22,
    name: "libri e media",
    slug: "libri-e-media",
    type: "out" as const,
  },
  { id: 23, name: "tempo libero", slug: "tempo-libero", type: "out" as const },
  { id: 33, name: "benessere", slug: "benessere", type: "out" as const },
  {
    id: 34,
    name: "bonifici e rimborsi",
    slug: "bonifici-e-rimborsi",
    type: "out" as const,
  },
  // IN
  {
    id: 24,
    name: "income da lavoro",
    slug: "income-da-lavoro",
    type: "in" as const,
  },
  {
    id: 25,
    name: "income finanziari",
    slug: "income-finanziari",
    type: "in" as const,
  },
  {
    id: 26,
    name: "sconti, rimborsi e cashback",
    slug: "sconti-rimborsi-e-cashback",
    type: "in" as const,
  },
  {
    id: 27,
    name: "vendite e dismissioni",
    slug: "vendite-e-dismissioni",
    type: "in" as const,
  },
  {
    id: 28,
    name: "movimenti di liquidità",
    slug: "movimenti-di-liquidita",
    type: "in" as const,
  },
  // SYSTEM
  { id: 32, name: "ignore", slug: "ignore", type: "system" as const },
];

// ---------------------------------------------------------------------------
// SUBCATEGORIES
// ---------------------------------------------------------------------------

export const subCategories = [
  // Risparmio (1)
  { categoryId: 1, name: "conto risparmio", slug: "conto-risparmio" },
  { categoryId: 1, name: "fondo emergenze", slug: "fondo-emergenze" },
  { categoryId: 1, name: "fondo pensione", slug: "fondo-pensione" },
  {
    categoryId: 1,
    name: "risparmio per progetti",
    slug: "risparmio-per-progetti",
  },
  {
    categoryId: 1,
    name: "risparmio per investimenti",
    slug: "risparmio-per-investimenti",
  },
  {
    categoryId: 1,
    name: "obiettivi a lungo termine",
    slug: "obiettivi-a-lungo-termine",
  },
  { categoryId: 1, name: "risparmio per salute", slug: "risparmio-per-salute" },
  // Abbonamenti (2)
  { categoryId: 2, name: "altri abbonamenti", slug: "altri-abbonamenti" },
  { categoryId: 2, name: "streaming video", slug: "streaming-video" },
  { categoryId: 2, name: "streaming musica", slug: "streaming-musica" },
  { categoryId: 2, name: "software e app", slug: "software-e-app" },
  {
    categoryId: 2,
    name: "servizi telefonici e internet",
    slug: "servizi-telefonici-e-internet",
  },
  {
    categoryId: 2,
    name: "piattaforme didattiche",
    slug: "piattaforme-didattiche",
  },
  { categoryId: 2, name: "banca", slug: "banca" },
  // Assicurazioni (3)
  { categoryId: 3, name: "auto", slug: "auto" },
  { categoryId: 3, name: "casa", slug: "casa" },
  { categoryId: 3, name: "salute", slug: "salute" },
  { categoryId: 3, name: "viaggio", slug: "viaggio" },
  {
    categoryId: 3,
    name: "responsabilità civile",
    slug: "responsabilita-civile",
  },
  { categoryId: 3, name: "animali domestici", slug: "animali-domestici" },
  // Vacanze (4)
  { categoryId: 4, name: "alloggio", slug: "alloggio" },
  { categoryId: 4, name: "trasporto", slug: "trasporto" },
  {
    categoryId: 4,
    name: "attività e intrattenimento",
    slug: "attivita-e-intrattenimento",
  },
  { categoryId: 4, name: "cibo e bevande", slug: "cibo-e-bevande" },
  {
    categoryId: 4,
    name: "assicurazione viaggio",
    slug: "assicurazione-viaggio",
  },
  // Regali (5)
  { categoryId: 5, name: "compleanni", slug: "compleanni" },
  { categoryId: 5, name: "festività", slug: "festivita" },
  { categoryId: 5, name: "anniversari", slug: "anniversari" },
  { categoryId: 5, name: "amici e conoscenti", slug: "amici-e-conoscenti" },
  // Trasporti (7)
  { categoryId: 7, name: "carburante", slug: "carburante" },
  { categoryId: 7, name: "elettricità per auto", slug: "elettricita-per-auto" },
  { categoryId: 7, name: "mezzi pubblici", slug: "mezzi-pubblici" },
  { categoryId: 7, name: "taxi e ride sharing", slug: "taxi-e-ride-sharing" },
  { categoryId: 7, name: "treno", slug: "treno" },
  { categoryId: 7, name: "pedaggi autostradali", slug: "pedaggi-autostradali" },
  { categoryId: 7, name: "spese telepass", slug: "spese-telepass" },
  { categoryId: 7, name: "ztl e parcheggi", slug: "ztl-e-parcheggi" },
  // Spesa (8)
  { categoryId: 8, name: "supermercato", slug: "supermercato" },
  { categoryId: 8, name: "spesa online", slug: "spesa-online" },
  { categoryId: 8, name: "prodotti freschi", slug: "prodotti-freschi" },
  {
    categoryId: 8,
    name: "prodotti non alimentari",
    slug: "prodotti-non-alimentari",
  },
  { categoryId: 8, name: "spesa bio", slug: "spesa-bio" },
  // Salute (9)
  { categoryId: 9, name: "visite mediche", slug: "visite-mediche" },
  { categoryId: 9, name: "farmaci e medicinali", slug: "farmaci-e-medicinali" },
  { categoryId: 9, name: "trattamenti medici", slug: "trattamenti-medici" },
  { categoryId: 9, name: "farmaci generici", slug: "farmaci-generici" },
  { categoryId: 9, name: "parafarmaceutici", slug: "parafarmaceutici" },
  // Ristorazione (10)
  { categoryId: 10, name: "cene fuori", slug: "cene-fuori" },
  { categoryId: 10, name: "pranzi", slug: "pranzi" },
  { categoryId: 10, name: "colazioni e snack", slug: "colazioni-e-snack" },
  { categoryId: 10, name: "take-away", slug: "take-away" },
  // Shopping (11)
  { categoryId: 11, name: "elettronica", slug: "elettronica" },
  { categoryId: 11, name: "abbigliamento", slug: "abbigliamento" },
  {
    categoryId: 11,
    name: "prodotti per la casa",
    slug: "prodotti-per-la-casa",
  },
  { categoryId: 11, name: "giocattoli", slug: "giocattoli" },
  { categoryId: 11, name: "scarpe", slug: "scarpe" },
  { categoryId: 11, name: "accessori", slug: "accessori" },
  {
    categoryId: 11,
    name: "attrezzatura sportiva",
    slug: "attrezzatura-sportiva",
  },
  // Investimenti (12) — categoria mantenuta per classificazione spese
  { categoryId: 12, name: "azioni", slug: "azioni" },
  { categoryId: 12, name: "obbligazioni", slug: "obbligazioni" },
  { categoryId: 12, name: "criptovalute", slug: "criptovalute" },
  { categoryId: 12, name: "fondi comuni", slug: "fondi-comuni" },
  { categoryId: 12, name: "immobili", slug: "immobili" },
  // Bollette e utilità (13)
  { categoryId: 13, name: "energia elettrica", slug: "energia-elettrica" },
  { categoryId: 13, name: "gas", slug: "gas" },
  { categoryId: 13, name: "acqua", slug: "acqua" },
  { categoryId: 13, name: "rifiuti", slug: "rifiuti" },
  // Rate e finanziamenti (14)
  { categoryId: 14, name: "mutuo casa", slug: "mutuo-casa" },
  { categoryId: 14, name: "finanziamenti auto", slug: "finanziamenti-auto" },
  { categoryId: 14, name: "altri finanziamenti", slug: "altri-finanziamenti" },
  // Tasse, imposte e commissioni (15)
  { categoryId: 15, name: "imposte", slug: "imposte" },
  { categoryId: 15, name: "imposte governative", slug: "imposte-governative" },
  { categoryId: 15, name: "bolli auto", slug: "bolli-auto" },
  {
    categoryId: 15,
    name: "commissioni bancarie",
    slug: "commissioni-bancarie",
  },
  // Famiglia (18)
  { categoryId: 18, name: "spese scolastiche", slug: "spese-scolastiche" },
  {
    categoryId: 18,
    name: "attività extra-scolastiche",
    slug: "attivita-extra-scolastiche",
  },
  { categoryId: 18, name: "baby-sitter", slug: "baby-sitter" },
  // Casa (19)
  {
    categoryId: 19,
    name: "manutenzione ordinaria",
    slug: "manutenzione-ordinaria",
  },
  { categoryId: 19, name: "ristrutturazione", slug: "ristrutturazione" },
  { categoryId: 19, name: "affitto", slug: "affitto" },
  { categoryId: 19, name: "badante", slug: "badante" },
  { categoryId: 19, name: "servizi di pulizia", slug: "servizi-di-pulizia" },
  // Formazione (21)
  { categoryId: 21, name: "corsi online", slug: "corsi-online" },
  { categoryId: 21, name: "università", slug: "universita" },
  {
    categoryId: 21,
    name: "corsi di specializzazione",
    slug: "corsi-di-specializzazione",
  },
  // Libri e media (22)
  { categoryId: 22, name: "libri cartacei", slug: "libri-cartacei" },
  { categoryId: 22, name: "e-book", slug: "e-book" },
  { categoryId: 22, name: "audiolibri", slug: "audiolibri" },
  // Tempo libero (23)
  { categoryId: 23, name: "cinema", slug: "cinema" },
  { categoryId: 23, name: "eventi", slug: "eventi" },
  // Income da lavoro (24)
  { categoryId: 24, name: "stipendio base", slug: "stipendio-base" },
  { categoryId: 24, name: "bonus", slug: "bonus" },
  { categoryId: 24, name: "indennità", slug: "indennita" },
  { categoryId: 24, name: "overtime", slug: "overtime" },
  { categoryId: 24, name: "freelance", slug: "freelance" },
  { categoryId: 24, name: "consulenze", slug: "consulenze" },
  {
    categoryId: 24,
    name: "progetti occasionali",
    slug: "progetti-occasionali",
  },
  { categoryId: 24, name: "commissioni", slug: "commissioni" },
  // Income finanziari (25)
  { categoryId: 25, name: "dividendi azionari", slug: "dividendi-azionari" },
  {
    categoryId: 25,
    name: "dividendi fondi comuni",
    slug: "dividendi-fondi-comuni",
  },
  {
    categoryId: 25,
    name: "dividendi immobiliari",
    slug: "dividendi-immobiliari",
  },
  // Sconti, rimborsi e cashback (26)
  {
    categoryId: 26,
    name: "rimborso spese lavorative",
    slug: "rimborso-spese-lavorative",
  },
  {
    categoryId: 26,
    name: "rimborso spese sanitarie",
    slug: "rimborso-spese-sanitarie",
  },
  {
    categoryId: 26,
    name: "rimborso spese viaggi",
    slug: "rimborso-spese-viaggi",
  },
  {
    categoryId: 26,
    name: "rimborso ordine online",
    slug: "rimborso-ordine-online",
  },
  {
    categoryId: 26,
    name: "cashback carta di credito",
    slug: "cashback-carta-di-credito",
  },
  {
    categoryId: 26,
    name: "cashback acquisti online",
    slug: "cashback-acquisti-online",
  },
  {
    categoryId: 26,
    name: "cashback programmi fedeltà",
    slug: "cashback-programmi-fedelta",
  },
  { categoryId: 26, name: "sconto abbonamento", slug: "sconto-abbonamento" },
  { categoryId: 26, name: "sconto promozionale", slug: "sconto-promozionale" },
  { categoryId: 26, name: "sconto canone", slug: "sconto-canone" },
  // Vendite e dismissioni (27)
  {
    categoryId: 27,
    name: "vendita di beni usati",
    slug: "vendita-di-beni-usati",
  },
  { categoryId: 27, name: "commercio online", slug: "commercio-online" },
  { categoryId: 27, name: "immobili", slug: "immobili-vendita" },
  {
    categoryId: 27,
    name: "vendita investimenti",
    slug: "vendita-investimenti",
  },
  // Movimenti di liquidità (28)
  { categoryId: 28, name: "bonifico in entrata", slug: "bonifico-in-entrata" },
  { categoryId: 28, name: "ricariche conti", slug: "ricariche-conti" },
  // Ignore (32)
  { categoryId: 32, name: "trasferimento", slug: "trasferimento" },
  {
    categoryId: 32,
    name: "addebito carta di credito",
    slug: "addebito-carta-di-credito",
  },
  // Benessere (33)
  { categoryId: 33, name: "cure estetiche", slug: "cure-estetiche" },
  { categoryId: 33, name: "sport", slug: "sport" },
  { categoryId: 33, name: "psicologia", slug: "psicologia" },
  { categoryId: 33, name: "massaggi", slug: "massaggi" },
  { categoryId: 33, name: "corsi fitness", slug: "corsi-fitness" },
  // Bonifici e rimborsi (34)
  { categoryId: 34, name: "bonifico in uscita", slug: "bonifico-in-uscita" },
  { categoryId: 34, name: "rimborsi", slug: "rimborsi" },
];

// ---------------------------------------------------------------------------
// PLATFORMS
// ---------------------------------------------------------------------------

export type AmountType = "single" | "separate";

export const platforms = [
  {
    id: 1,
    name: "General",
    slug: "general",
    country: "ALL",
    delimiter: ",",
    descriptionColumn: "description",
    amountType: "single" as AmountType,
    amountColumn: "amount",
    positiveAmountColumn: null,
    negativeAmountColumn: null,
    timestampColumn: "timestamp",
    dateFormat: null,
    dateReplace: false,
    decimalReplace: false,
    multiplyBy: 1,
  },
  {
    id: 3,
    name: "Satispay",
    slug: "satispay",
    country: "IT",
    delimiter: ",",
    descriptionColumn: "Nome",
    amountType: "single" as AmountType,
    amountColumn: "Importo",
    positiveAmountColumn: null,
    negativeAmountColumn: null,
    timestampColumn: "Data",
    dateFormat: "DD MMM YYYY. HH:mm:ss",
    dateReplace: true,
    decimalReplace: false,
    multiplyBy: 1,
  },
  {
    id: 4,
    name: "Intesa SP",
    slug: "intesa-sp",
    country: "IT",
    delimiter: ",",
    descriptionColumn: "Operazione",
    amountType: "single" as AmountType,
    amountColumn: "Importo",
    positiveAmountColumn: null,
    negativeAmountColumn: null,
    timestampColumn: "Data",
    dateFormat: "DD-MM-YYYY",
    dateReplace: true,
    decimalReplace: true,
    multiplyBy: 1,
  },
  {
    id: 5,
    name: "Intesa SP Carta Credito",
    slug: "intesa-sp-carta-credito",
    country: "IT",
    delimiter: ",",
    descriptionColumn: "Descrizione",
    amountType: "single" as AmountType,
    amountColumn: "Addebiti",
    positiveAmountColumn: null,
    negativeAmountColumn: null,
    timestampColumn: "Data operazione",
    dateFormat: "DD/MM/YYYY",
    dateReplace: true,
    decimalReplace: true,
    multiplyBy: -1,
  },
  {
    id: 6,
    name: "Revolut",
    slug: "revolut",
    country: "IT",
    delimiter: ",",
    descriptionColumn: "Description",
    amountType: "single" as AmountType,
    amountColumn: "Amount",
    positiveAmountColumn: null,
    negativeAmountColumn: null,
    timestampColumn: "Completed Date",
    dateFormat: null,
    dateReplace: false,
    decimalReplace: false,
    multiplyBy: 1,
  },
  {
    id: 7,
    name: "Fineco",
    slug: "fineco",
    country: "IT",
    delimiter: ",",
    descriptionColumn: "Descrizione_Completa",
    amountType: "separate" as AmountType,
    amountColumn: null,
    positiveAmountColumn: "Entrate",
    negativeAmountColumn: "Uscite",
    timestampColumn: "Data",
    dateFormat: "DD/MM/YYYY",
    dateReplace: true,
    decimalReplace: false,
    multiplyBy: 1,
  },
];

// ---------------------------------------------------------------------------
// CATEGORIZATION PATTERNS (regex sistema, userId = null)
// ---------------------------------------------------------------------------

export type AmountSign = "positive" | "negative" | "any";

export const categorizationPatterns = [
  {
    pattern:
      "(?:\\bcoop\\b|\\bnova coop\\b|\\bmercato big\\b|\\bmercatò\\b|mercato.*local|\\besselunga\\b|\\bcarrefour\\b|\\bconad\\b|\\bpam\\b|\\btigre\\b|\\biper\\b|\\bsupermercato\\b|\\bsuper\\b|\\bmarket\\b|\\bcrai\\b|\\blidl\\b|\\beurospin\\b|\\bmd\\b|\\baldi\\b|\\bdespar\\b|\\beurospar\\b|\\binterspar\\b|\\bipercoop\\b|\\bbennet\\b|\\bil gigante\\b|\\bunes\\b|\\bu2\\b|\\bu!\\b|\\bfamila\\b|\\bsisa\\b|\\bsigma\\b|\\btodis\\b|\\bpewex\\b|\\biperal\\b)",
    subCategorySlug: "supermercato",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Supermarkets and grocery stores",
  },
  {
    pattern:
      "(?:\\bmacelleria\\b|\\bmacellaio\\b|\\bpescheria\\b|\\bpescivendolo\\b|\\bittic[oa]\\b|\\bortofrutta\\b|\\bortofrutt[ai]\\b|\\bfrutta e verdura\\b|\\bfruttivendolo\\b|\\bpanificio\\b|\\bpanetteria\\b|\\bforno\\b|\\bfornaio\\b|\\bgastronomia\\b|\\brosticceria\\b|\\bsalumeria\\b|\\bsalumiere\\b|\\bcaseificio\\b|\\blatticin[io]\\b|\\blatticini\\b|\\bformaggi\\b)",
    subCategorySlug: "prodotti-freschi",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 15,
    description: "Negozi specializzati in prodotti freschi",
  },
  {
    pattern: "(?:\\bamazon\\b|\\bamzn\\b)",
    subCategorySlug: "elettronica",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 20,
    description: "Amazon purchases",
  },
  {
    pattern:
      "(?:\\bmcdonald\\b|\\bburger king\\b|\\bkfc\\b|\\bpizza\\b|\\bristorante\\b|\\btrattoria\\b|\\bosteria\\b|\\bpizzeria\\b)",
    subCategorySlug: "cene-fuori",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 30,
    description: "Restaurants and fast food",
  },
  {
    pattern:
      "(?:\\bstarbucks\\b|\\bbar\\b|(?:^|[^a-zA-Z])caff(?:e|è|é|e[''`])(?:[^a-zA-Z]|$)|\\bcaffetteria\\b|\\bcoffee\\b|\\bespresso\\b)",
    subCategorySlug: "colazioni-e-snack",
    amountSign: "negative" as AmountSign,
    confidence: 0.85,
    priority: 40,
    description: "Bars and coffee shops",
  },
  {
    pattern: "(?:\\bpasticceria\\b|\\bpasticcerie\\b)",
    subCategorySlug: "colazioni-e-snack",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 35,
    description: "Pasticcerie e dolci",
  },
  {
    pattern: "(?:\\beni\\b.*\\bplenitude\\b|\\bplenitude\\b)",
    subCategorySlug: "energia-elettrica",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 5,
    description: "Eni Plenitude - Electricity",
  },
  {
    pattern:
      "(?:\\benel\\b|\\benel energia\\b|\\ba2a\\b|\\bedison\\b|\\bluce\\b|\\belettricità\\b|\\bgas\\b|\\bacqua\\b)",
    subCategorySlug: "energia-elettrica",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 10,
    description: "Energy and utility providers",
  },
  {
    pattern:
      "(?:\\beni\\b(?!.*plenitude)|\\besso\\b|\\bshell\\b|\\bq8\\b|\\btamoil\\b|\\bcarburante\\b|\\bbenzina\\b|\\bdiesel\\b|\\bgasolio\\b)",
    subCategorySlug: "carburante",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Gas stations and fuel",
  },
  {
    pattern:
      "(?:\\btrenitalia\\b|\\bitalo\\b|\\bfrecciarossa\\b|\\bfrecciargento\\b|\\bfrecciabianca\\b|\\btreno\\b|\\bferrovie\\b)",
    subCategorySlug: "treno",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 5,
    description: "Railway services and trains",
  },
  {
    pattern:
      "(?:\\batm\\b|\\bautostrada\\b|\\btelepass\\b|\\bpedaggio\\b|\\bviacard\\b)",
    subCategorySlug: "pedaggi-autostradali",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 20,
    description: "Highway tolls and telepass",
  },
  {
    pattern: "(?:\\buber\\b|\\btaxi\\b|\\bbolt\\b|\\bfreenow\\b)",
    subCategorySlug: "taxi-e-ride-sharing",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 30,
    description: "Shared transport services",
  },
  {
    pattern:
      "(?:\\bnetflix\\b|\\bdisney\\+?\\b|\\bprime video\\b|\\bamazon prime video\\b|\\bnow tv\\b|\\bnow\\b|\\bapple tv\\+?\\b|\\braiplay\\b|\\bmediaset infinity\\b|\\bdazn\\b|\\bparamount\\+?\\b|\\bsky go\\b|\\bdiscovery\\+?\\b|\\byoutube premium\\b)",
    subCategorySlug: "streaming-video",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Video streaming services",
  },
  {
    pattern:
      "(?:\\bspotify\\b|\\bapple music\\b|\\bamazon music\\b|\\bdeezer\\b|\\btidal\\b|\\byoutube music\\b)",
    subCategorySlug: "streaming-musica",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Music streaming services",
  },
  {
    pattern: "(?:\\bfarmacia\\b|\\bpharmacy\\b|\\bparafarmacia\\b)",
    subCategorySlug: "farmaci-generici",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 20,
    description: "Pharmacies and parapharmacies",
  },
  {
    pattern:
      "(?:\\bospedale\\b|\\bclinica\\b|\\bmedico\\b|\\bdottore\\b|\\bvisita\\b|\\banalisi\\b)",
    subCategorySlug: "visite-mediche",
    amountSign: "negative" as AmountSign,
    confidence: 0.85,
    priority: 30,
    description: "Medical visits and healthcare facilities",
  },
  {
    pattern:
      "(?:\\bpalestra\\b|\\bgym\\b|\\bfitness\\b|\\bpiscina\\b|\\bsport\\b|\\bpadel\\b|\\btennis\\b)",
    subCategorySlug: "sport",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 35,
    description: "Sport: palestre, padel, tennis, fitness, piscine",
  },
  {
    pattern: "canone mensile",
    subCategorySlug: "altri-abbonamenti",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 10,
    description: "Canoni mensili vari",
  },
  {
    pattern:
      "(?:\\bvodafone\\b|\\btim\\b|\\bwind\\b|\\bwindtre\\b|\\biliad\\b|\\bfastweb\\b|\\bposte ?mobile\\b|\\bcoop ?voce\\b|\\bho ?mobile\\b|\\bho\\.\\b|\\bvery ?mobile\\b|\\bkena\\b|\\btiscali\\b|\\bsky wifi\\b|\\bsky mobile\\b|\\bspusu\\b|\\blycamobile\\b)",
    subCategorySlug: "servizi-telefonici-e-internet",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 5,
    description: "Operatori telefonici in Italia",
  },
  {
    pattern: "bonifico",
    subCategorySlug: "bonifico-in-uscita",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Bonifici in uscita",
  },
  {
    pattern: "bonifico",
    subCategorySlug: "bonifico-in-entrata",
    amountSign: "positive" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Bonifici in entrata",
  },
  {
    pattern:
      "(?:commissioni?.*spese.*adue|commissione.*disposizione.*bonifico|commissione.*bonifico)",
    subCategorySlug: "commissioni-bancarie",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 10,
    description: "Commissioni bancarie",
  },
  {
    pattern: "addebito diretto.*volkswagen",
    subCategorySlug: "finanziamenti-auto",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 5,
    description: "Rate Volkswagen Bank",
  },
  {
    pattern: "addebito diretto.*fca bank",
    subCategorySlug: "finanziamenti-auto",
    amountSign: "negative" as AmountSign,
    confidence: 0.95,
    priority: 5,
    description: "Rate FCA Bank",
  },
  {
    pattern: "addebito diretto.*disposto.*favore",
    subCategorySlug: "altri-finanziamenti",
    amountSign: "negative" as AmountSign,
    confidence: 0.8,
    priority: 20,
    description: "Addebiti diretti per finanziamenti vari",
  },
  {
    pattern: "(?:stipendio.*pensione|^stipendio$|^pensione$)",
    subCategorySlug: "stipendio-base",
    amountSign: "positive" as AmountSign,
    confidence: 0.95,
    priority: 5,
    description: "Stipendi e pensioni",
  },
  {
    pattern: "(?:^|[^a-z0-9])pago\\s*pa(?:[^a-z0-9]|$)",
    subCategorySlug: "imposte",
    amountSign: "any" as AmountSign,
    confidence: 0.75,
    priority: 90,
    description: "PagoPA - da classificare manualmente",
  },
  {
    pattern:
      "(?:\\bfocacceria\\b|\\bpizza\\s*al\\s*taglio\\b|\\brosticceria\\b|\\btavola\\s*calda\\b|\\bpaninoteca\\b|\\bgastronomia\\b)",
    subCategorySlug: "take-away",
    amountSign: "negative" as AmountSign,
    confidence: 0.9,
    priority: 35,
    description: "Take away: focaccerie, pizza al taglio, rosticcerie",
  },
];
