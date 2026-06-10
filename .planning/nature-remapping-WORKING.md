# Nature remapping — working document

**Started:** 2026-06-09 · feeds phase `NATURE-TABLE-01` · contract: `docs/adr/0012` + `CONTEXT.md`

Goal: assign every subcategory to the correct nature under the new 8-nature / 4-direction model, once.

Target natures: `income`, `income_extraordinary` (IN) · `essential`, `discretionary`, `debt` (OUT) · `transfer` (TRANSFER) · `savings`, `investment` (ALLOCATION).

Rules: direction is derived from nature · divestment/refund nets (no linking) · operational dissolved · renames financial→investment, extraordinary→savings.

---

## Current state snapshot (before remap)

Format: `[catId] category (type)` → `subcategory` = current nature

**IN categories**
- [24] income da lavoro: stipendio-base=income, bonus=income_extraordinary, indennita=income, overtime=income, freelance=income_extraordinary, consulenze=income_extraordinary, progetti-occasionali=income_extraordinary, commissioni=income_extraordinary
- [25] income finanziari: dividendi-azionari=income, dividendi-fondi-comuni=income, dividendi-immobiliari=income
- [26] sconti, rimborsi e cashback: rimborso-spese-lavorative, rimborso-spese-sanitarie, rimborso-spese-viaggi, rimborso-ordine-online, cashback-carta-di-credito, cashback-acquisti-online, cashback-programmi-fedelta (all financial+income_extraordinary); sconto-abbonamento, sconto-promozionale, sconto-canone (financial) — NB renamed by seed-extras step 4
- [27] vendite e dismissioni: vendita-di-beni-usati, commercio-online, immobili-vendita, vendita-investimenti (all financial+income_extraordinary)
- [28] movimenti di liquidità (DEPRECATED per CONTEXT transfer migration): bonifico-in-entrata, ricariche-conti

**OUT categories**
- [1] risparmio: conto-risparmio, fondo-emergenze, fondo-pensione, risparmio-per-progetti, risparmio-per-investimenti, obiettivi-a-lungo-termine, risparmio-per-salute (all extraordinary)
- [2] abbonamenti: altri-abbonamenti, streaming-video, streaming-musica, software-e-app, servizi-telefonici-e-internet, piattaforme-didattiche, banca (all operational)
- [3] assicurazioni: auto, casa, salute, viaggio, responsabilita-civile, animali-domestici (all operational)
- [4] vacanze: alloggio, trasporto, attivita-e-intrattenimento, cibo-e-bevande, assicurazione-viaggio (discretionary)
- [5] regali: compleanni, festivita, anniversari, amici-e-conoscenti (discretionary)
- [7] trasporti: carburante, elettricita-per-auto, mezzi-pubblici, taxi-e-ride-sharing, treno, pedaggi-autostradali, spese-telepass, ztl-e-parcheggi (essential)
- [8] spesa: supermercato, spesa-online, prodotti-freschi, prodotti-non-alimentari, spesa-bio (essential); discount, negozio-di-quartiere, mercato-rionale, drogheria-e-casalinghi (NONE)
- [9] salute: visite-mediche, farmaci-e-medicinali, trattamenti-medici, farmaci-generici, parafarmaceutici (essential)
- [10] ristorazione: cene-fuori, pranzi, colazioni-e-snack, take-away (discretionary)
- [11] shopping: elettronica, abbigliamento, prodotti-per-la-casa, giocattoli, scarpe, accessori, attrezzatura-sportiva (discretionary)
- [12] investimenti: azioni, obbligazioni, criptovalute, fondi-comuni, immobili (financial)
- [13] bollette e utilità: energia-elettrica, gas, acqua, rifiuti (essential)
- [14] rate e finanziamenti: mutuo-casa, finanziamenti-auto, altri-finanziamenti (debt)
- [15] tasse, imposte e commissioni: imposte, imposte-governative, bolli-auto, commissioni-bancarie (operational)
- [18] famiglia: spese-scolastiche, attivita-extra-scolastiche, baby-sitter (essential)
- [19] casa: manutenzione-ordinaria, ristrutturazione, affitto, badante, servizi-di-pulizia (essential)
- [21] formazione: corsi-online, universita, corsi-di-specializzazione (operational)
- [22] libri e media: libri-cartacei, e-book, audiolibri (discretionary)
- [23] tempo libero: cinema, eventi (discretionary)
- [33] benessere: cure-estetiche, sport, psicologia, massaggi, corsi-fitness (discretionary)
- [34] bonifici e rimborsi: bonifico-in-uscita (financial), rimborsi (financial+income_extraordinary)

**SYSTEM**
- [32] ignore (→ becoming Trasferimenti per CONTEXT): trasferimento, addebito-carta-di-credito (NONE, excludeFromTotals)

---

## Pruning principle (user, 2026-06-09)
Minimise the number of categories/subcategories. Flag redundant/noise subcategories for removal or merge alongside each nature assignment. Users can always create their own.

## Final remap (filled nature-by-nature as we confirm)

### ✅ DIRECTION IN — FINAL (confirmed 2026-06-09)

**Cat: Income da lavoro**
- `stipendio-base` · income
- `indennita` · income
- `bonus` · income_extraordinary
- `freelance` · income_extraordinary
- `consulenze` · income_extraordinary
- `progetti-occasionali` · income_extraordinary
- `commissioni` · income_extraordinary

**Cat: Pensioni e sussidi** 🆕
- `pensione` 🆕 · income
- `sussidi-statali` 🆕 · income (assegno unico, NASpI, bonus statali)

**Cat: Rendite** _(rename of "Income finanziari")_
- `dividendi` · income _(merge of dividendi-azionari/fondi-comuni/immobiliari)_
- `interessi-attivi` 🆕 · income
- `canone-di-locazione` 🆕 · income

**Cat: Entrate straordinarie** _(merge of cat 26 "sconti, rimborsi e cashback" + cat 27 "vendite e dismissioni")_
- `cashback` · income_extraordinary _(merge ×3)_
- `bonus-promozionale` · income_extraordinary
- `vendita-beni-usati` · income_extraordinary _(merge vendita-di-beni-usati + commercio-online)_
- `eredita-e-donazioni` 🆕 · income_extraordinary

**Removed:** `overtime`; all `rimborso-*` (6) → net under the original expense; `sconto-canone`.
**Moved out of IN:** `vendita-investimenti`, `immobili-vendita` → allocation/investment (divestment, nets); `bonifico-in-entrata`, `ricariche-conti` → transfer (cat 28 deprecated).
**Rule:** tax refund (730/IRPEF) nets under `imposte` if same period; income_extraordinary if decoupled.

IN categories: 5 → 4 (Income da lavoro · Pensioni e sussidi · Rendite · Entrate straordinarie).

### ✅ DIRECTION OUT — FINAL (confirmed 2026-06-09)

Dissolved categories: **Famiglia** (beneficiary-based), **Assicurazioni** (wrapper → distributed by object), **Abbonamenti** (wrapper → distributed by purpose), **Risparmio** (→ allocation), **Investimenti** (→ allocation), **Bonifici e rimborsi** (→ transfer / net). Nature `operational` dissolved into essential/discretionary.

Nature legend: E=essential · D=discretionary · DEBT=debt

1. **Trasporti** — `carburante-e-ricarica` (E) · `manutenzione-auto` (E) · `mezzi-pubblici` (E) · `taxi-e-ride-sharing` (E) · `pedaggi-e-parcheggi` (E) · `assicurazione-veicoli` (E)
2. **Spesa** — `spesa-quotidiana` (E) · `casalinghi-e-non-alimentari` (E) · `bio-vino-e-gourmet` (D)
3. **Salute** — `visite-mediche` (E) · `trattamenti-medici` (E) · `farmaci` (E) · `assicurazione-salute` (D)
4. **Utenze** _(era Bollette e utilità)_ — `energia-elettrica` (E) · `gas` (E) · `acqua` (E) · `rifiuti` (E) · `telefono-e-internet` (E)
5. **Casa** — `affitto` (E) · `spese-condominiali` (E) · `manutenzione-casa` (E, incl. idraulico/elettricista/giardiniere) · `servizi-domestici` (E, colf/badante/baby-sitter) · `assicurazione-casa` (E)
6. **Imposte e oneri** _(era Tasse, imposte e commissioni)_ — `imposte` (E) · `bolli-auto` (E) · `multe-e-sanzioni` (E) · `commissioni-e-canone-conto` (E)
7. **Servizi professionali** 🆕 — `spese-legali-notarili` (E)
8. **Formazione** — `universita` (E) · `spese-scolastiche` (E) · `corsi` (D, incl. piattaforme-didattiche + attività-extra-scolastiche)
9. **Vacanze** — `alloggio` (D) · `trasporto` (D) · `attivita-e-intrattenimento` (D) · `cibo-e-bevande` (D) · `assicurazione-viaggio` (D)
10. **Regali e donazioni** — `regali` (D) · `donazioni-beneficenza` (D)
11. **Ristorazione** — `ristoranti` (D) · `bar-caffe-e-snack` (D) · `take-away-e-delivery` (D)
12. **Shopping** — `elettronica` (D) · `abbigliamento-e-accessori` (D) · `prodotti-per-la-casa` (D) · `giocattoli` (D)
13. **Cultura e tempo libero** _(merge Tempo libero + Libri e media)_ — `cinema-ed-eventi` (D) · `libri-e-audiolibri` (D) · `streaming` (D) · `app-e-software` (D) · `videogiochi` (D)
14. **Benessere** — `sport-e-fitness` (D) · `attrezzatura-e-abbigliamento-sportivo` (D) · `cura-della-persona` (D, estetista/parrucchiere/cosmetici/massaggi/spa/terme) · `psicologia` (D)
15. **Animali** 🆕 — `cura-animali` (D, cibo+veterinario+toelettatura) · `assicurazione-animali` (D)
16. **Rate e finanziamenti** — `mutuo-casa` (DEBT) · `finanziamenti-auto` (DEBT) · `altri-finanziamenti` (DEBT)

OUT categories: 16 · ~50 subcategories · natures essential/discretionary/debt.

**Dropped subcats:** overtime, altri-abbonamenti, spesa-online, all grocery store-type splits (discount/negozio-di-quartiere/mercato-rionale), all rimborso-* (net under expense). Merges: dividendi, cashback, vendita-beni-usati, imposte, farmaci, streaming, regali, ristoranti, abbigliamento-e-accessori, etc.

### Categorization rules (the "regola madre")
1. Categorize by **purpose / life-domain**, not by transaction-type, channel, merchant, or beneficiary.
2. **Pragmatic exception:** an unsplittable mixed receipt → catch-all of the dominant purpose (e.g. weekly supermarket run incl. some household → `spesa-quotidiana`, essential).
3. **Wrappers** (insurance, subscriptions) are distributed by object/purpose; **taxes and debt keep their own categories** (their essence is the obligation, not a consumption domain).
4. **Gifting is a purpose** that prevails over the object (gifted TV → `regali`, not elettronica). Distinct from beneficiary: a family member's need is categorized by the need (kid's course → Formazione).
   - Examples: book at a supermarket → Cultura (not Spesa); pet food → Animali (not Spesa); running suit → Benessere/sport (not Abbigliamento); gifted TV → Regali (not Shopping).

### ✅ DIRECTION ALLOCATION — FINAL (confirmed 2026-06-09)

Neutro al patrimonio ma tracciato. Versamenti (+) e disinvestimenti (−) nettano sotto la **stessa** sottocategoria (no `vendita-*` separate). Reddito generato (dividendi/cedole/interessi) NON è allocation → è IN/Rendite.

**Category: Risparmio** → nature `savings` _(ex cat 1, era `extraordinary`)_
- `conto-risparmio` (liquidità da parte, conto deposito, libretto/buoni postali)
- `fondo-emergenze` (riserva 3–6 mesi)
- `accantonamenti-obiettivi` _(merge risparmio-per-progetti + obiettivi-a-lungo-termine + risparmio-per-salute + risparmio-per-investimenti)_

**Category: Investimenti** → nature `investment` _(ex cat 12, era `financial`)_
- `titoli-e-fondi` _(merge azioni + obbligazioni + fondi-comuni; include ETF, BTP/BOT, PAC)_
- `criptovalute`
- `immobili` (acquisto e vendita nettano qui)
- `previdenza-complementare` _(rinom. da fondo-pensione; fondo pensione + PIP)_
- `polizze-vita` 🆕 (assicurazioni vita d'investimento, ramo I/III)
- `oro-e-beni-rifugio` 🆕 (oro fisico, metalli preziosi)

Skip (nicchia, l'utente le crea): crowdfunding/P2P, equity in startup, arte/collezionismo, forex.

ALLOCATION: 2 categorie · 9 sottocategorie.

_Next: DIRECTION TRANSFER._
