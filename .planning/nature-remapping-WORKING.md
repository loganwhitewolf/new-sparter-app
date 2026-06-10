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

_Next: DIRECTION OUT — essential / discretionary / debt._
