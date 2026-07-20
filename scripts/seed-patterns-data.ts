// Canonical system categorization regex patterns (userId = null).
// Single source of truth — loaded by scripts/seed-patterns.ts (full replace of system rows).
// New patterns from regex-discovery go here, not in seed-data.ts or seed-extras.ts.

export type SystemCategorizationPatternSeed = {
  pattern: string;
  subCategorySlug: string;
  confidence: number;
  priority: number;
  description: string;
};

export const systemCategorizationPatterns: SystemCategorizationPatternSeed[] = [
  // --- baseline (formerly seed-data.ts) ---
  {
    pattern:
      "(?:\\bcoop\\b|\\bnova coop\\b|\\bmercato big\\b|\\bmercatò\\b|mercato.*local|\\besselunga\\b|\\bcarrefour\\b|\\bconad\\b|\\bpam\\b|\\btigre\\b|\\btigros\\b|\\biper\\b|\\bsupermercato\\b|\\bsuper\\b|\\bmarket\\b|\\bcrai\\b|\\blidl\\b|\\beurospin\\b|\\bmd\\b|\\baldi\\b|\\bdespar\\b|\\beurospar\\b|\\binterspar\\b|\\bipercoop\\b|\\bbennet\\b|\\bil gigante\\b|\\bunes\\b|\\bu2\\b|\\bu!\\b|\\bfamila\\b|\\bsisa\\b|\\bsigma\\b|\\btodis\\b|\\bpewex\\b|\\biperal\\b|\\bpenny\\b|\\bprix\\b|\\bprix quality\\b|\\bdpi[ùu]\\b|\\bd[- ]?pi[ùu]\\b|\\bins\\b|\\bin'?s\\b|\\bnaturas[iì]\\b|\\bnatura s[iì]\\b|\\becoranaturasi\\b|\\btuod[iì]\\b|\\bagor[aà]\\b|\\bselex\\b|\\bvisotto\\b|\\bmigross\\b|\\btosano\\b|\\bauchan\\b|\\bsimply\\b|\\bintermarche\\b|\\bintermarch[eé]\\b|\\bdec[oò]\\b|\\bmegamark\\b|\\bgabrielli\\b|\\bmagazzini gabrielli\\b|\\bleader price\\b|\\bcadoro\\b|\\brossetto\\b|\\baspiag\\b|\\bsidis\\b|\\bgulliver\\b|\\bcastoro\\b|\\bmaxi d\\b|\\bmaxid\\b|\\brisparmio casa\\b|\\b7[- ]?eleven\\b|\\bal[iì] super\\b|\\bsupermercati al[iì]\\b|\\ba&o\\b|\\bpaladini\\b|\\bmacelleria\\b|\\bmacellaio\\b|\\bpescheria\\b|\\bpescivendolo\\b|\\bittic[oa]\\b|\\bortofrutta\\b|\\bortofrutt[ai]\\b|\\bfrutta e verdura\\b|\\bfruttivendolo\\b|\\bpanificio\\b|\\bpanetteria\\b|\\bforno\\b|\\bfornaio\\b|\\bforneria\\b|\\bsalumeria\\b|\\bsalumiere\\b|\\bcaseificio\\b|\\blatticin[io]\\b|\\blatticini\\b|\\bformaggi\\b|\\bbilla\\b|\\bpastificio\\b|\\beataly\\b|\\bsapore di mare\\b)",
    subCategorySlug: "spesa-quotidiana",
    confidence: 0.9,
    priority: 10,
    description: "Grocery: supermarkets, fresh food shops, and named merchants",
  },
  {
    pattern: "(?:\\bamazon\\b|\\bamzn\\b)",
    subCategorySlug: "elettronica",
    confidence: 0.9,
    priority: 20,
    description: "Amazon purchases",
  },
  {
    pattern:
      "(?:\\bmcdonald\\b|\\bburger king\\b|\\bkfc\\b|\\bpizza\\b|\\bristorante\\b|\\btrattoria\\b|\\bosteria\\b|\\bpizzeria\\b)",
    subCategorySlug: "ristoranti",
    confidence: 0.9,
    priority: 30,
    description: "Restaurants and fast food",
  },
  {
    pattern:
      "(?:\\bstarbucks\\b|\\bbar\\b|(?:^|[^a-zA-Z])caff(?:e|è|é|e[''`])(?:[^a-zA-Z]|$)|\\bcaffetteria\\b|\\bcoffee\\b|\\bespresso\\b|\\bcaf[eèé]|\\bpasticceria\\b|\\bpasticcerie\\b|\\bgelateria\\b|\\bcaramella\\b)",
    subCategorySlug: "bar-caffe-e-snack",
    confidence: 0.85,
    priority: 35,
    description: "Bars, cafes, pastry, ice cream, and sweet snacks",
  },
  {
    pattern: "(?:\\beni\\b.*\\bplenitude\\b|\\bplenitude\\b)",
    subCategorySlug: "energia-elettrica",
    confidence: 0.95,
    priority: 5,
    description: "Eni Plenitude - Electricity",
  },
  {
    pattern:
      "(?:\\benel\\b|\\benel energia\\b|\\ba2a\\b|\\bedison\\b|\\bluce\\b|\\belettricità\\b|\\bgas\\b|\\bacqua\\b)",
    subCategorySlug: "energia-elettrica",
    confidence: 0.9,
    priority: 10,
    description: "Energy and utility providers",
  },
  {
    pattern:
      "(?:\\beni\\b(?!.*plenitude)|\\besso\\b|\\bshell\\b|\\bq8\\b|\\btamoil\\b|\\bcarburante\\b|\\bbenzina\\b|\\bdiesel\\b|\\bgasolio\\b)",
    subCategorySlug: "carburante-e-ricarica",
    confidence: 0.95,
    priority: 10,
    description: "Gas stations and fuel",
  },
  {
    pattern:
      "(?:\\btrenitalia\\b|\\bitalo\\b|\\bfrecciarossa\\b|\\bfrecciargento\\b|\\bfrecciabianca\\b|\\btreno\\b|\\bferrovie\\b)",
    subCategorySlug: "mezzi-pubblici",
    confidence: 0.95,
    priority: 5,
    description: "Railway services and trains",
  },
  {
    pattern:
      "(?:\\batm\\b|\\bautostrada\\b|\\btelepass\\b|\\bpedaggio\\b|\\bviacard\\b|\\badf\\b|\\bcdt\\b|\\bfree flow\\b)",
    subCategorySlug: "pedaggi-e-parcheggi",
    confidence: 0.9,
    priority: 20,
    description: "Highway tolls, telepass, and free-flow systems",
  },
  {
    pattern: "(?:\\buber\\b|\\btaxi\\b|\\bbolt\\b|\\bfreenow\\b)",
    subCategorySlug: "taxi-e-ride-sharing",
    confidence: 0.9,
    priority: 30,
    description: "Shared transport services",
  },
  {
    pattern:
      "(?:\\bnetflix\\b|\\bdisney\\+?\\b|\\bprime video\\b|\\bamazon prime video\\b|\\bnow tv\\b|\\bnow\\b|\\bapple tv\\+?\\b|\\braiplay\\b|\\bmediaset infinity\\b|\\bdazn\\b|\\bparamount\\+?\\b|\\bsky go\\b|\\bdiscovery\\+?\\b|\\byoutube premium\\b)",
    subCategorySlug: "streaming",
    confidence: 0.95,
    priority: 10,
    description: "Video streaming services",
  },
  {
    pattern:
      "(?:\\bspotify\\b|\\bapple music\\b|\\bamazon music\\b|\\bdeezer\\b|\\btidal\\b|\\byoutube music\\b)",
    subCategorySlug: "streaming",
    confidence: 0.95,
    priority: 10,
    description: "Music streaming services",
  },
  {
    pattern: "(?:\\bfarmacia\\b|\\bpharmacy\\b|\\bparafarmacia\\b)",
    subCategorySlug: "farmaci",
    confidence: 0.9,
    priority: 20,
    description: "Pharmacies and parapharmacies",
  },
  {
    pattern:
      "(?:\\bospedale\\b|\\bclinica\\b|\\bmedico\\b|\\bdottore\\b|\\bvisita\\b|\\banalisi\\b)",
    subCategorySlug: "visite-mediche",
    confidence: 0.85,
    priority: 30,
    description: "Medical visits and healthcare facilities",
  },
  {
    pattern:
      "(?:palestra|gym|fitness|crossfit|pilates|yoga|ginnastica|piscina|nuoto|" +
      "padel|tennis|squash|golf(?![oa])|\\bsci\\b|snowboard|skate|pattinaggio|" +
      "surf|windsurf|vela|canoa|kayak|calcio|football|soccer|" +
      "boxe|pugilato|kickboxing|karate|judo|taekwondo|aikido|muay|" +
      "arrampicata|climbing|boulder|trekking|hiking|escursion|" +
      "pallavolo|volley|volleyball|basketball|pallacanestro|\\bbasket\\b|rugby|" +
      "atletica|maratona|triathlon|ironman|running|ciclismo|bicicletta|cycling|\\bbici\\b|" +
      "equitazione|maneggio|\\bscherma\\b|hockey|badminton|danza|dance|\\bsport\\b)",
    subCategorySlug: "sport-e-fitness",
    confidence: 0.9,
    priority: 35,
    description:
      "Sport and fitness: substring match for compounds (GPadel, SuperFitness); word boundaries on short/risky tokens (sport, sci, bici, scherma, basket)",
  },
  {
    pattern: "canone mensile",
    subCategorySlug: "app-e-software",
    confidence: 0.9,
    priority: 10,
    description: "Canoni mensili vari",
  },
  {
    pattern:
      "(?:\\bvodafone\\b|\\btim\\b|\\bwind\\b|\\bwindtre\\b|\\biliad\\b|\\bfastweb\\b|\\bposte ?mobile\\b|\\bcoop ?voce\\b|\\bho ?mobile\\b|\\bho\\.\\b|\\bvery ?mobile\\b|\\bkena\\b|\\btiscali\\b|\\bsky wifi\\b|\\bsky mobile\\b|\\bspusu\\b|\\blycamobile\\b)",
    subCategorySlug: "telefono-e-internet",
    confidence: 0.95,
    priority: 5,
    description: "Operatori telefonici in Italia",
  },
  {
    pattern:
      "(?:commissioni?.*spese.*adue|commissione.*disposizione.*bonifico|commissione.*bonifico)",
    subCategorySlug: "commissioni-e-canone-conto",
    confidence: 0.95,
    priority: 10,
    description: "Commissioni bancarie",
  },
  {
    pattern: "addebito diretto.*volkswagen",
    subCategorySlug: "finanziamenti-auto",
    confidence: 0.95,
    priority: 5,
    description: "Rate Volkswagen Bank",
  },
  {
    pattern: "addebito diretto.*fca bank",
    subCategorySlug: "finanziamenti-auto",
    confidence: 0.95,
    priority: 5,
    description: "Rate FCA Bank",
  },
  {
    pattern: "addebito diretto.*disposto.*favore",
    subCategorySlug: "altri-finanziamenti",
    confidence: 0.8,
    priority: 20,
    description: "Addebiti diretti per finanziamenti vari",
  },
  {
    pattern:
      "(?:stipendio.*pensione|^stipendio$|^pensione$|\\baccredito stipendio\\b)",
    subCategorySlug: "stipendio-base",
    confidence: 0.95,
    priority: 5,
    description: "Salary and pension credits",
  },
  {
    pattern:
      "(?:^|[^a-z0-9])pago\\s*pa(?:[^a-z0-9]|$)|\\bimposta di bollo\\b|\\brit\\.ced|\\bprotocollo delega\\b",
    subCategorySlug: "imposte",
    confidence: 0.85,
    priority: 15,
    description: "Taxes: PagoPA, stamp duty, withholding, delegations",
  },
  {
    pattern:
      "(?:\\bfocacceria\\b|\\bpizza\\s*al\\s*taglio\\b|\\brosticceria\\b|\\btavola\\s*calda\\b|\\bpaninoteca\\b|\\bgastronomia\\b)",
    subCategorySlug: "take-away-e-delivery",
    confidence: 0.9,
    priority: 25,
    description: "Take away: focaccerie, pizza al taglio, rosticcerie",
  },
  {
    pattern: "(?:\\bdeliveroo\\b|\\bjust\\s*eat\\b|\\bglovo\\b|\\bwolt\\b)",
    subCategorySlug: "take-away-e-delivery",
    confidence: 0.95,
    priority: 25,
    description: "Delivery app orders",
  },

  // --- regex-discovery 2026-06-15 (multi-export) ---
  {
    pattern: "(?:\\bclaude\\.ai\\b|\\bitunes)",
    subCategorySlug: "app-e-software",
    confidence: 0.85,
    priority: 100,
    description:
      "Software/app subscriptions (Claude.ai, Apple iTunes/App Store)",
  },
  {
    pattern:
      "(?:\\bautogrill\\b|\\brestaurant\\b|\\bramen\\b|\\bpiadineria\\b|\\bbirreria\\b|\\bpinsa\\b|\\bbistrot\\b)",
    subCategorySlug: "ristoranti",
    confidence: 0.8,
    priority: 100,
    description: "Restaurants and food venue types",
  },
  {
    pattern: "(?:\\bautolavaggio\\b)",
    subCategorySlug: "manutenzione-auto",
    confidence: 0.9,
    priority: 100,
    description: "Car wash",
  },
  {
    pattern: "(?:\\bferramenta\\b)",
    subCategorySlug: "casalinghi-e-non-alimentari",
    confidence: 0.85,
    priority: 100,
    description: "Hardware store",
  },
  {
    pattern: "(?:\\bgeox\\b|\\bmarlboro\\b)",
    subCategorySlug: "abbigliamento-e-accessori",
    confidence: 0.85,
    priority: 100,
    description: "Clothing/footwear (Geox, Marlboro Classics)",
  },
  {
    pattern: "(?:\\bhotel\\b)",
    subCategorySlug: "alloggio",
    confidence: 0.8,
    priority: 100,
    description: "Hotels / lodging",
  },
  {
    pattern: "(?:\\bgenerali\\b)",
    subCategorySlug: "assicurazione-veicoli",
    confidence: 0.8,
    priority: 100,
    description: "Generali vehicle insurance",
  },

  // --- regex-discovery 2026-06-15 satispay ---
  {
    pattern: "(?:\\bsalvadanaio\\b)",
    subCategorySlug: "accantonamenti-obiettivi",
    confidence: 0.85,
    priority: 100,
    description: "Satispay salvadanaio (savings allocation)",
  },
  {
    pattern: "(?:\\bbaita\\b)",
    subCategorySlug: "ristoranti",
    confidence: 0.8,
    priority: 100,
    description: "Mountain eatery (baita)",
  },

  // --- regex-discovery 2026-06-15 fineco ---
  {
    pattern: "(?:\\bced\\.su\\b)",
    subCategorySlug: "interessi-attivi",
    confidence: 0.85,
    priority: 100,
    description: "Bond coupon income (cedole BTP)",
  },

  // --- regex-discovery 2026-06-15 movements (Intesa) ---
  {
    pattern: "(?:\\bquas\\b)",
    subCategorySlug: "assicurazione-salute",
    confidence: 0.9,
    priority: 100,
    description: "QUAS health insurance premiums",
  },
  {
    pattern: "(?:\\bcondominio\\b)",
    subCategorySlug: "spese-condominiali",
    confidence: 0.9,
    priority: 100,
    description: "Condominium fees (bonifici)",
  },
  {
    pattern: "(?:\\bstudio odontoiatric)",
    subCategorySlug: "trattamenti-medici",
    confidence: 0.9,
    priority: 100,
    description: "Dental studio payments",
  },
  {
    pattern: "(?:\\bsatispay europe\\b)",
    subCategorySlug: "trasferimento-tra-conti",
    confidence: 0.9,
    priority: 100,
    description: "Satispay wallet top-up (SDD)",
  },
  {
    pattern: "(?:\\bdirecta sim\\b)",
    subCategorySlug: "titoli-e-fondi",
    confidence: 0.9,
    priority: 100,
    description: "Directa SIM broker deposits",
  },
  {
    pattern: "(?:\\btartufe\\b)",
    subCategorySlug: "bio-vino-e-gourmet",
    confidence: 0.85,
    priority: 100,
    description: "Truffle/gourmet shop (Tartufe)",
  },
  {
    pattern: "(?:\\blegami\\b)",
    subCategorySlug: "giocattoli",
    confidence: 0.9,
    priority: 100,
    description: "Legami (gifts/toys/stationery — more toys than stationery)",
  },
  // --- discovery 2026-06-15 (Fineco current account) ---
  {
    pattern: "(?:\\brevolut\\b)",
    subCategorySlug: "trasferimento-tra-conti",
    confidence: 0.85,
    priority: 100,
    description: "Revolut wallet top-up (internal transfer)",
  },
  {
    pattern: "(?:\\bmangopay\\b|\\bvinted\\b)",
    subCategorySlug: "vendita-beni-usati",
    confidence: 0.85,
    priority: 100,
    description: "Vinted sales payouts (via Mangopay)",
  },
  {
    pattern: "(?:\\bpolisport)",
    subCategorySlug: "sport-e-fitness",
    confidence: 0.8,
    priority: 100,
    description: "Sports association (polisportiva)",
  },

  // --- Phase 67 vacanze audit (D-14): travel-only trasporto ---
  {
    pattern:
      "(?:\\bryanair\\b|\\beasyjet\\b|\\bvolo\\b|\\bvoli\\b|\\baerolinee\\b|\\blufthansa\\b|\\bair france\\b|\\bklm\\b|\\bwizz ?air\\b|\\btraghett[oi]\\b|\\bferry\\b|\\bautonoleggio\\b|\\bcar rental\\b|\\brent[ao]car\\b|\\bhertz\\b|\\bavis\\b|\\beuropcar\\b|\\bsixt\\b|\\bnoleggio auto\\b)",
    subCategorySlug: "trasporto",
    confidence: 0.85,
    priority: 100,
    description:
      "Travel-specific transport: flights, ferries, car rental — excludes daily commute (metro, bus, tram, local trains, taxi/ride-sharing) which stay routed to mezzi-pubblici/taxi-e-ride-sharing.",
  },
];

export function validateSystemCategorizationPatterns(
  subCategorySlugs: ReadonlySet<string>,
): { missingSlugs: string[]; duplicateKeys: string[]; invalidRegex: string[] } {
  const missingSlugs: string[] = [];
  const duplicateKeys: string[] = [];
  const invalidRegex: string[] = [];
  const seen = new Set<string>();

  for (const row of systemCategorizationPatterns) {
    if (!subCategorySlugs.has(row.subCategorySlug)) {
      missingSlugs.push(row.subCategorySlug);
    }

    const key = `${row.pattern}\0${row.subCategorySlug}`;
    if (seen.has(key)) {
      duplicateKeys.push(key.replace("\0", " → "));
    }
    seen.add(key);

    try {
      RegExp(row.pattern, "i");
    } catch {
      invalidRegex.push(row.pattern);
    }
  }

  return {
    missingSlugs: [...new Set(missingSlugs)],
    duplicateKeys,
    invalidRegex,
  };
}
