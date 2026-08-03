# Quick Task 260731-hhv: UX contratto feedback Sparter - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** `/Users/andreabernardini/Downloads/sparterfeedbackcontratto.md`

<domain>
## Task Boundary

Implement PRONTO + bug items from the Sparter UX/UI feedback contract (onboarding, Categorizza, Benvenuto/Dashboard). Close binary product decisions locked below. Explicitly defer items that need mockup or domain definition.

**In scope (must plan):**
- 1.1 Stepper centered top, font ≥ 16px
- 1.2 + 1.4 + 2.1 secondary-text / inactive-chip contrast ≥ 4.5:1 (treat as one design-system / token fix, apply in three surfaces)
- 1.3 Drag&drop area: `background #fff; border 2px dashed #717171` (or equivalent token; local OK unless trivial to promote)
- 2.2 Categorize modal: movement text + manual input placeholder contrast ≥ 4.5:1
- 2.3 Split subcategory "carburante e ricarica" → two categories (names locked below)
- 3.1 Welcome screen: single CTA "Vai alla dashboard" only
- 3.2 Uncategorized-movements tag → link (locked)
- 3.3 Hide "Suggerimenti pattern" box when empty / "Nessun suggerimento trovato"
- 3.4 Pattern UI copy: natural Italian, no regex jargon (locked draft direction)
- 3.5 Expenses section: add period filter consistent with existing temporal filters
- 3.6 Income/expense cards clickable → corresponding detail
- 3.7 BUG: "Crea categoria" in personal category modal errors — reproduce and fix (high priority)
- 3.10 Ammortamenti: rename in UI only (locked)

**Deferred (document in PLAN deferred section; do not implement):**
- 2.4 Subcategory hover/selected / "Più usate" IA — needs colleague confirmation
- 3.8 First-dashboard visual hierarchy — needs mockup/wireframe
- 3.9 Bilancio "tasso" / 20% threshold — needs domain definition in CONTEXT.md before copy rewrite

</domain>

<decisions>
## Implementation Decisions

### 3.2 — Tag movimenti da categorizzare
- Becomes a navigable link to uncategorized movements (do not remove).
- Prefer existing transactions filter route/query already used for "da categorizzare" / unclassified; do not invent a new status param if one exists.

### 3.10 — Ammortamenti consumer naming
- Rename in **UI copy only** (labels, nav, headings, empty states). Example target: "Spese dilazionate".
- Keep DB slug / routes / domain identifiers unchanged (`amortizations`, etc.).
- No plan/feature-gate hide.

### 3.4 — Pattern section copy
- Direction locked: natural Italian, hide regex technicism.
- Draft: "Regole automatiche" (not "Regole regex"); "Aggiorna la regola…" (not "Aggiorna la regex…"); examples like `netflix` without `/netflix/i` slash-flags exposed.
- Never show the word "regex" in user-facing product copy for this surface.
- Final polish can iterate wording; direction is fixed.

### 2.3 — Split Carburante e ricarica
- New names: **Carburante** + **Ricarica auto elettrica**.
- New slugs (not restore historical `elettricita-per-auto`): derive from names (`carburante`, `ricarica-auto-elettrica` or project slug convention).
- Additive: `seed-extras.ts` STEP — never edit `seed-data.ts` shapes for the new columns/rows pattern; migrate existing rows/usages from `carburante-e-ricarica`.
- Update linked system patterns in `seed-patterns-data.ts` (fuel vs EV charge patterns split appropriately).
- Preserve user data: reassign transactions/expenses pointing at old subcategory to the correct new one where deterministic; document ambiguity handling in PLAN.

### Contrast (1.2 / 1.4 / 2.1)
- Single token/utility approach preferred over three one-off color hacks.
- WCAG AA normal text ≥ 4.5:1 including inactive filter chips.

### Branch / execution (2026-07-31)
- **Stay on current branch** `gsd/quick-260730-o82-tx-direction-multi`. Do **not** create a new quick branch or git worktree.
- Execute waves 01→02→03 sequentially on this checkout (`workflow.use_worktrees=false` for this run).

### Claude's Discretion
- Exact Italian string for 3.10 if "Spese dilazionate" collides with existing copy — pick closest consumer-friendly label, keep consistent across surfaces.
- Dropzone: local styles OK; promote to shared token only if a dropzone primitive already exists.
- Wave/task split of the PRONTO list for executability.

</decisions>

<specifics>
## Specific Ideas

- Feedback note: 1.2, 1.4, 2.1 are the same secondary-contrast rule — one fix, three call sites.
- 3.7 is a functional bug — prioritize early in execution order; not negotiable with colleague.
- Seeds are additive: follow CLAUDE.md `seed-extras` + `seed-patterns` run order.

</specifics>

<canonical_refs>
## Canonical References

- Feedback contract: `/Users/andreabernardini/Downloads/sparterfeedbackcontratto.md`
- Project rules: `CLAUDE.md` (Decimal, seeds additive, layers, language)
- Domain vocabulary: `CONTEXT.md` (do not invent conflicting terms; 3.9 deferred until domain write-up)
- Taxonomy: `scripts/seed-data.ts`, `scripts/seed-extras.ts`, `scripts/seed-patterns-data.ts`

</canonical_refs>
