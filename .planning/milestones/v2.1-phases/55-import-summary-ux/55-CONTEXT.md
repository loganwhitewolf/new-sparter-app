# Phase 55: import-summary-ux - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Render the post-import suggestions page legible: cap example transactions shown in the analyze preview, give the two suggestion groups (regex candidates vs identical-description groups) distinct headings with intro text, and add a descriptive sub-heading on the suggestions page that communicates discovery now happens as a separate step. Remove the legacy pre-import pattern detection entirely.

Delivers **SUMUI-01, SUMUI-02, SUMUI-03** only. Does not change the discovery service, the promote flow, or the on-demand re-check behaviour (Phase 54 scope).

</domain>

<decisions>
## Implementation Decisions

### SUMUI-03 — "Discovery is a separate step" cue
- **D-01:** The cue lives exclusively in the **suggestions page** (`/import/[fileId]/suggestions`). The post-import CTA ("X pattern proposti — Rivedi suggerimenti") in `ImportPreview` is left unchanged.
- **D-02:** The cue is a **descriptive sub-heading paragraph** (`p.text-muted-foreground`) below the existing `h1 "Suggerimenti pattern"`. No Alert/banner — a plain descriptive sentence. Content must communicate: (a) these patterns were detected from uncategorized transactions of this platform after the import, and (b) the user can re-check at any time from the Importazioni tab. Exact Italian copy at planner discretion.

### SUMUI-02 — Visual separation of regex vs single-categorization suggestions
- **D-03:** Use **clear section headings with short intro text** for each group. The existing card-heavy (regex) vs compact-row (single-cat) layout already provides structural differentiation — no new icons, colours, or visual elements added. Only the heading labels and a 1-line descriptor below each heading need polish.
- **D-04:** Single-categorization items remain **read-only informational** — no action, no CTA, no link. The user categorizes them manually from the Spese page.

### SUMUI-01 — Cap example transactions
- **D-05:** Cap the sample rows rendered in `ImportPreview` (the analyze page table) at **10** rows. The parser/service can retain up to 25 for internal use; the UI slices to 10 at render time (or wherever is most natural — planner's discretion on the slice location).

### Legacy cleanup — remove detectPatternSuggestions from the analyze flow
- **D-06:** Remove the `detectPatternSuggestions()` call from `analyzeImportAction` in `lib/services/import.ts` (the `// TODO Phase 55: remove` block, lines ~301–316).
- **D-07:** Remove the `patternSuggestions` field from `ImportAnalysisResult` type and from the returned object in `lib/services/import.ts`.
- **D-08:** Remove `<SuggestionSection>` from `ImportPreview` (`components/import/import-preview.tsx`) and its import. The analyze page no longer shows any suggestions pre-import.
- **D-09:** **Delete** the `detectPatternSuggestions()` function (and `detectPatternSuggestionsWithMeta()` if it has no remaining consumers) from `lib/utils/pattern-suggestions.ts`, along with their tests. The planner must first grep for any remaining non-discovery consumers before deleting; if any survive, leave the function and note it.

### Claude's Discretion
- Exact Italian copy for the sub-heading in the suggestions page (tone: informational, not promotional).
- Exact heading labels for the two SuggestionSection groups (e.g., "Pattern proposti" vs "Transazioni identiche — nessun pattern").
- The 1-line descriptor text below each section heading.
- Whether the sample rows cap (D-05) is applied in `ImportPreview` at render time or pushed down into the service/type — as long as the UI shows ≤10.
- Whether `detectPatternSuggestionsWithMeta()` is also deleted or retained (depends on grep results for non-discovery consumers).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / requirements definition
- `.planning/ROADMAP.md` §"Phase 55: import-summary-ux" — goal, success criteria 1–3.
- `.planning/REQUIREMENTS.md` — SUMUI-01, SUMUI-02, SUMUI-03 (all three open, resolved here).

### Components to modify
- `components/import/import-preview.tsx` — ImportPreview: remove SuggestionSection, cap sampleRows to 10 (D-05, D-06, D-07, D-08).
- `components/import/suggestion-section.tsx` — SuggestionSection: polish section headings + add intro text (D-03).
- `app/(app)/import/[fileId]/suggestions/page.tsx` — add descriptive sub-heading paragraph (D-01, D-02).
- `lib/services/import.ts` — remove `detectPatternSuggestions()` call + `patternSuggestions` field (D-06, D-07). See `// TODO Phase 55: remove` comment (~lines 301–316).
- `lib/utils/pattern-suggestions.ts` — delete `detectPatternSuggestions()` + `detectPatternSuggestionsWithMeta()` after grep (D-09).

### Upstream context (scope alignment)
- `.planning/phases/54-reusable-trigger/54-CONTEXT.md` — D-05: post-import CTA left unchanged; D-04: suggestions page is the canonical rendering surface.
- `.planning/phases/52-regex-validity-and-dedup/52-CONTEXT.md` — DiscoveryResult shape: `candidates` (regex) + `singleCategorizationSuggestions` (identical groups). Already capped at 10+10 in the service.
- `.planning/phases/54-reusable-trigger/54-CONTEXT.md` §"Suggestions page migration" — D-04: `SuggestionSection` receives `candidates` + `singleCategorizationSuggestions` from `discoverRegexCandidates`.

### Domain language
- `CONTEXT.md` (repo root) — Transaction vs Expense, categorization tiers, descriptionHash, platform.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuggestionSection` (`components/import/suggestion-section.tsx`) — already accepts `suggestions` (regex) and `singleSuggestions` (identical) as separate props; two `<section>` elements with `aria-label`. Modify headings + add intro text, no structural change needed.
- `SuggestionCard` (`components/import/suggestion-card.tsx`) — full card with promote form; no changes needed in this phase.
- Existing `p.text-muted-foreground` in the suggestions page (`/suggestions/page.tsx`) — replace or augment to carry the SUMUI-03 cue.

### Established Patterns
- Shadcn/ui `Card`, `Badge`, `Alert` already in use — keep to the same component kit.
- Italian product copy for all user-facing strings; English for identifiers, comments, logs.
- `aria-label` on `<section>` elements in SuggestionSection — preserve accessibility when renaming headings.

### Integration Points
- `ImportAnalysisResult.patternSuggestions` — removing this field means updating both the type definition in `lib/services/import.ts` and any downstream consumer (the analyze page + ImportPreview). Run `grep -r "patternSuggestions"` before deleting.
- `SuggestionSection` in `import-preview.tsx` — removing it simplifies the component to: summary tiles + format override + warnings + errors + sample rows table (capped) + confirm button.
- The suggestions page already imports `SuggestionSection`; no routing change needed.

### Notes on sample rows cap
- Parser sets `DEFAULT_SAMPLE_SIZE = 25` (keeps 25 for internal detection logic).
- `ImportPreview` renders `result.sampleRows.map(...)` with no slice — a `slice(0, 10)` in the map expression or a variable is the minimal change.

</code_context>

<specifics>
## Specific Ideas

- The SUMUI-03 cue should mention two things: (a) the platform scope of the discovery ("analisi sulle transazioni non categorizzate di questa piattaforma"), and (b) the re-check entry point ("puoi ricontrollare dal tab Importazioni"). This prevents confusion when the user lands on the suggestions page from the post-import CTA and wonders why results differ from what they expected.
- The "Transazioni identiche" section heading should make clear that these are not proposed regex candidates — the user should understand these are identical descriptions that need manual categorization, not automation proposals.

</specifics>

<deferred>
## Deferred Ideas

- Link from single-cat items to the Spese page filtered by description — future enhancement; out of scope here (D-04 confirmed read-only).
- Quick-categorize inline for single-cat items — new capability, own phase.
- Bulk "ricontrolla tutto" re-check across all platforms — already deferred in Phase 54.
- Dismissal of suggestions (DISM-01) — tracked in REQUIREMENTS.md Future Requirements.

</deferred>

---

*Phase: 55-import-summary-ux*
*Context gathered: 2026-06-21*
