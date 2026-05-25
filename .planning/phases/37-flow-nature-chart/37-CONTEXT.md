# Phase 37: flow-nature-chart - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers FlowNature: a `nature` nullable enum column on `sub_category`, a redesigned `EntrateUsciteChart` that stacks bars by nature (algebraic sum per nature), URL-persisted nature toggles via `?hidden=`, Italian labels in a shared utility, system subcategory default natures in the seed, user override of nature via an inline Select in `/settings/categories`, and the override stored in `user_subcategory_override`.

What this does NOT include: a refund nature value, category-level nature, a separate nature breakdown page, or changes to KPI cards / BilancioBarsChart.

</domain>

<decisions>
## Implementation Decisions

### Toggle UI nel grafico
- **D-01:** Toggle via **legenda cliccabile** di Recharts — clic su un item nella legenda Recharts nasconde/mostra quel segmento natura. Nessun blocco UI aggiuntivo.
- **D-02:** Lo stato toggle si **sincronizza con l'URL** via `router.replace()` aggiornando `?hidden=` ad ogni clic (pattern identico a `OverviewFilters`). Persiste tra navigazioni.
- **D-03:** Stato default (tutte le nature visibili) = **`?hidden=` assente dall'URL**. Il param viene rimosso quando l'hidden set è vuoto, come `preset` in `OverviewFilters`.

### Etichette italiane nature
- **D-04:** Mappa etichette enum → italiano:
  - `essential` → `Essenziale`
  - `discretionary` → `Discrezionale`
  - `operational` → `Operativo`
  - `financial` → `Finanziario`
  - `debt` → `Debiti`
  - `extraordinary` → `Straordinario`
- **D-05:** Segmento null-nature → etichetta **"Non classificato"** (sia nella legenda chart che nel Select di settings).
- **D-06:** La mappa etichette vive in **`lib/utils/nature-labels.ts`** come modulo condiviso tra il chart component e il Select settings (single source of truth, evita duplicazione).

### Editing natura in settings
- **D-07:** Modifica natura sottocategorie esistenti via **Select inline nella riga** della subcategory (nessun dialog aggiuntivo). Salvataggio on-change tramite server action.
- **D-08:** Il Select inline si applica a **tutte le sottocategorie** — sia personali (owned) sia di sistema. L'utente può sovrascrivere la natura di sistema per il suo account.
- **D-09:** L'override natura per sottocategorie di sistema viene salvato aggiungendo una **colonna `nature` nullable alla tabella `user_subcategory_override`** esistente. `null` = usa la natura di default dal `sub_category.nature` del seed; valorizzato = override utente. Stesso pattern del nome personalizzato già presente nella tabella.

### Claude's Discretion
- Palette colori per le 6 nature nel chart (scegli colori distinti da CSS vars o colori hardcoded, coerenti con lo stile shadcn/ui esistente).
- Visibilità del segmento "Non classificato": visibile solo quando ci sono transazioni con natura null, oppure sempre visibile.
- Colore specifico del segmento "Non classificato" (suggerimento: grigio neutro).
- Assegnazione specifica delle nature alle ~120 sottocategorie di sistema nel seed (`seed-data.ts`) — la logica di categorizzazione è a discrezione del planner/executor seguendo la semantica degli enum values.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architectural decisions (LOCKED)
- `docs/adr/0003-flownature-at-subcategory-level.md` — Locks: nature vive su sub_category (non category), nullable, system seeded, user required on creation, "non classificato" è un segmento di prima classe
- `docs/adr/0004-nature-segments-algebraic-sum.md` — Locks: somma algebrica per natura (non sign-split), nessun valore refund, un segmento può essere netto positivo in una OUT category

### Schema e DAL
- `lib/db/schema.ts` — definizioni `subCategory` (colonne attuali, incluso `excludeFromTotals`) e `userSubcategoryOverride` (struttura override corrente)
- `lib/dal/dashboard.ts` — tipo `MonthlyTrendPoint`, funzione `getMonthlyTrend` (da evolvere per grouping per natura), `DASHBOARD_TOTAL_EXPENSE_STATUSES`

### Componenti da evolvere
- `components/dashboard/entrate-uscite-chart.tsx` — chart corrente da rimpiazzare (Recharts BarChart con due `<Bar>`, `ChartContainer/ChartLegend/ChartTooltip` da shadcn/ui)
- `components/categories/category-mutation-dialogs.tsx` — `CreateSubcategoryDialog` (da estendere con campo natura), `RenameSubcategoryDialog` (non modificato)

### Pattern URL params (da replicare)
- `components/dashboard/overview-filters.tsx` — pattern `useSearchParams` + `router.replace` + `startTransition` per URL sync
- `components/dashboard/dashboard-filters.tsx` — stesso pattern, utile come secondo riferimento

### Seed system data
- `scripts/seed-data.ts` — lista completa delle ~120 sottocategorie di sistema da aggiornare con natures di default

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChartContainer`, `ChartLegend`, `ChartLegendContent`, `ChartTooltip`, `ChartTooltipContent` da `@/components/ui/chart` (shadcn/ui) — già importati in `entrate-uscite-chart.tsx`, il nuovo chart può usare gli stessi wrapper
- `useSearchParams` / `useRouter` / `usePathname` — già presenti in 4+ componenti, import pattern consolidato
- `useDialogAction` hook in `category-mutation-dialogs.tsx` — riutilizzabile per eventuali dialog aggiuntivi

### Established Patterns
- URL param sync: `const params = new URLSearchParams(searchParams.toString()); params.set/delete('key', value); startTransition(() => router.replace(pathname + '?' + params.toString(), { scroll: false }))`
- Server actions in settings: `useActionState` + `formAction` + `toast.success` — pattern in `category-mutation-dialogs.tsx`
- Monetary values come dal DAL come `string`, usare `toDecimal()` prima di calcoli

### Integration Points
- `getMonthlyTrend` in `lib/dal/dashboard.ts` deve fare JOIN attraverso `sub_category.nature` (e `user_subcategory_override.nature` come override) e groupare per natura anziché per tipo importo
- `user_subcategory_override` ha bisogno di colonna `nature` nullable → Drizzle migration
- `createSubcategoryAction` in `lib/actions/categories.ts` deve accettare il campo `nature` obbligatorio
- Nuova server action (es. `setSubcategoryNatureAction`) per il Select inline on-change in `/settings/categories`

</code_context>

<specifics>
## Specific Ideas

- Toggle via click sulla legenda Recharts nativa (non custom click handler separato)
- `?hidden=` contiene nature comma-separate (es. `?hidden=discretionary,debt`) — decodifica in un `Set<Nature>` al mount
- `lib/utils/nature-labels.ts` esporta sia la mappa label sia un array ordinato delle nature per il rendering della legenda/select
- L'inline Select natura nella riga subcategory deve usare il componente `Select` shadcn/ui già importato in `category-mutation-dialogs.tsx`

</specifics>

<deferred>
## Deferred Ideas

- **Pagina breakdown per natura** — una vista dedicata che mostra il dettaglio delle spese per ogni natura (scope creep per questa fase, potrebbe essere v1.12)
- **Non classificato sempre visibile** — se il team decide in futuro che il segmento "Non classificato" deve essere sempre presente anche a zero, è una modifica alla query aggregation (deferred, Claude decide il comportamento corrente)

</deferred>

---

*Phase: 37-flow-nature-chart*
*Context gathered: 2026-05-25*
