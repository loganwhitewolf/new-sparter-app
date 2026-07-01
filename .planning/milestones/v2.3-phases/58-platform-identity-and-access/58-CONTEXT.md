# Phase 58: platform-identity-and-access - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (docs/adr/0015-platform-global-moderated-format-private.md)

> Ingest note: ADR 0015 uses Italian Nygard headers (`Contesto`/`Decisione`/`Conseguenze`),
> which the auto ADR parser (English-only header map) could not classify — it returned zero
> decisions. Decisions below were extracted manually from ADR 0015, cross-checked against
> ROADMAP Phase 58 success criteria and REQUIREMENTS PLAT-01..03. ADR 0015 extends ADR 0013.

<domain>
## Phase Boundary

ADR 0015 carries four locked decisions; the v2.3 milestone splits them across three phases.
**This phase (58) owns only the data-model + access decisions** — making `platform` a
never-owned, review-gated identity, and decoupling a private Import Format from a private
Platform. The wizard UX and the seed slug-linkage are explicitly downstream (Phases 59 / 60).

Concretely, Phase 58 delivers:
- `platform` schema change: drop `visibility`, rename `ownerUserId` → `proposedByUserId`.
- Visibility driven by the existing `platform.reviewStatus` lifecycle (`pending` → proposer-only,
  `approved` → everyone; seeded platforms stay `approved`).
- `accessibleWhere` relaxed so a user-owned `importFormatVersion` is visible to its owner on
  **any** platform (global/approved included), keyed off `importFormatVersion.ownerUserId` —
  no longer requiring the platform itself to be private.
- An additive, idempotent migration (`0023`) + row backfill, with no behavioral regression on
  the hot `platform` join used for filter/display/sort by `platform.slug` / `platform.name`.

Prior art it builds on: ADR 0013 / Phase 57 already moved the parsing contract to
`importFormatVersion`; `platform` is already pure identity. The `reviewStatus` column already
exists on both tables (default `"approved"`) — this phase wires the lifecycle and removes
`platform.visibility`, it does not invent `reviewStatus`.

</domain>

<decisions>
## Implementation Decisions

- **D-01 — Platform is never user-owned (PLAT-01):** Drop the `platform.visibility` column and rename `platform.ownerUserId` → `platform.proposedByUserId` (provenance, not ownership). A "private platform owned by a user" is a contradiction — a provider identity is shared by nature.

- **D-02 — Additive, idempotent migration, no data loss (PLAT-01):** Schema change via `drizzle-kit generate` → migration `0023`, applied through `scripts/migrate.ts`; **never `drizzle-kit push` in production**. Existing platform rows are migrated without data loss — the value formerly in `ownerUserId` is preserved as `proposedByUserId` (a true `RENAME COLUMN` carries the data). Any row-level backfill on already-seeded rows is expressed as an idempotent step in `scripts/seed-extras.ts` STEPS — never edit `seed-data.ts` shapes (fallback only if a drop+add is unavoidable).

- **D-03 — reviewStatus is the visibility lifecycle (PLAT-02):** Platform visibility keys on `platform.reviewStatus` (column already present): `pending` → visible only to its `proposedByUserId`; `approved` → visible to all users. Seeded platforms remain `approved`. (Operator "approve → share" UI is deferred per ADR — see Deferred Ideas; single-user, a `pending` platform is already usable by its proposer.)

- **D-04 — Decouple private Import Format from private Platform (PLAT-03):** Relax `lib/dal/import-formats.ts` `accessibleWhere()` so a user-owned `importFormatVersion` (`ownerUserId = user`) is visible to its owner **even when attached to a global/approved platform**. Remove the platform-owner OR-branch (branch 3); private-format visibility keys off `importFormatVersion.ownerUserId`, not on the platform's visibility. Keep the global-approved path intact.

- **D-05 — No regression on the hot platform join (PLAT-03 / SC4):** The `platform` join used by expenses/transactions/imports for filter/display/sort by `platform.slug` / `platform.name` must behave identically before and after; existing global formats resolve and import exactly as before. Guard with tests over the existing global formats.

- **D-06 — Minimal caller adaptation to keep the build green (scope-boundary glue):** Dropping `platform.visibility` and renaming `ownerUserId` breaks current writers/readers of those columns; Phase 58 adapts **only** what keeps the app compiling and existing imports working — behavior-preserving glue, not feature work. Specifically: `lib/services/import-format-wizard.ts` `createPrivateRows()` (drop the `visibility` write; new platform born `reviewStatus='pending'`, not `'draft'`; insert key renamed to `proposedByUserId`) and the readers in `lib/dal/import-formats.ts` (validators `isGlobalApproved`/`isOwnedBy`, the `.select` projection, and `listPdfImportPlatformNames`). The wizard attach-format UX is **Phase 59**; the seed slug-linkage refactor is **Phase 60** — both out of scope here.

### Claude's Discretion
- **`importFormatVersion.visibility` handling.** ADR 0015 is silent on whether the format-level
  `visibility` column is dropped. The locked criteria only mandate dropping `platform.visibility`
  and keying access off `importFormatVersion.ownerUserId`. Planner/researcher to decide whether to
  keep `importFormatVersion.visibility` (and stop relying on it in `accessibleWhere`) or retire it;
  prefer the smallest change that satisfies D-04 + D-05.
- Exact shape of the no-regression test guard (unit over `accessibleWhere` WHERE-clause vs.
  integration over the six existing formats) — planner's call.
- Whether the `proposedByUserId` backfill belongs in migration SQL or a `seed-extras` STEP.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (source decisions)
- `docs/adr/0015-platform-global-moderated-format-private.md` — this phase's locked decisions (Italian).
- `docs/adr/0013-import-format-owns-parsing-contract.md` — parsing contract lives on `importFormatVersion`; `platform` is pure identity.

### Schema & migration
- `lib/db/schema.ts:254-276` — `platform` table. Has `ownerUserId` (text FK, nullable),
  `visibility` (varchar(24) default "global"), `reviewStatus` (varchar(24) default "approved"),
  `name`, `slug` (unique), `country`, `isActive`. **Drop `visibility`; rename `ownerUserId`→`proposedByUserId`.**
- `lib/db/schema.ts:278-323` — `importFormatVersion` table. Has `platformId` (FK notNull),
  `ownerUserId` (nullable), `visibility`, `reviewStatus`, `headerSignature`, and the parsing-contract
  columns incl. `descriptionStripPattern`.
- `drizzle/migrations/` — latest is `0022_wonderful_eternals.sql`; this phase generates `0023`.
- `scripts/migrate.ts` — migration runner (the only prod-safe path; no `drizzle-kit push`).
- `scripts/seed-extras.ts` — additive idempotent STEPS array (where a row-level backfill of existing rows lives, if needed).

### Access / visibility query
- `lib/dal/import-formats.ts:124-154` — `accessibleWhere(userId, selectedFormatVersionId)`: 3 OR-branches
  (global-approved / private-format-owner / **platform-owner ← remove**). Relax per D-04.
- `lib/dal/import-formats.ts:74-95` — validators `isGlobalApproved()`, `isOwnedBy()`, `isAccessibleImportFormat()`.

### Hot platform join (no-regression guard — D-05)
- `lib/dal/imports.ts:20-40,88-91,110-154` — imports-list select/sort joins `platform` on `platformId`; sort key `LOWER(platform.name)`, missing-platform bucket last.
- `lib/dal/regex-discovery.ts:74-126` — platform-scoped discovery (reads `platform` by id).
- Expenses/transactions platform joins — researcher to confirm exact files; success criterion 4 names all three surfaces.

### Callers to adapt (D-06)
- `lib/services/import-format-wizard.ts:211-289` — `createPrivateRows()` (writes `visibility`/`reviewStatus` on new platform).
- `lib/services/import-format-detector.ts:209-234` — `detectImportFormat()` (read-only here; full wizard branch is Phase 59).
- `scripts/seed-data.ts:896-947,956-1102` and `scripts/seed.ts:59-129` — adapt references to dropped/renamed columns only (slug-linkage is Phase 60).

### Glossary (read; correction is Phase 60)
- `CONTEXT.md:21-35` (repo root) — Platform / Import Format entries already align with ADR 0015;
  the DescriptionStripPattern entry still says "configurata per Platform" (stale → `importFormatVersion`); correction is PLAT-06 / Phase 60.

</canonical_refs>

<specifics>
## Specific Ideas

- `platform.reviewStatus` and `importFormatVersion.reviewStatus` already exist (default `"approved"`),
  so the lifecycle column is in place — Phase 58 wires its meaning into the visibility query and
  removes `platform.visibility`; it does not add `reviewStatus`.
- Lifecycle values are `pending` | `approved` (ADR/ROADMAP). The current wizard uses `draft` for new
  platforms — align that write to `pending` as part of D-06.
- The common real case (known bank, hand-reworked tracciato — e.g. a Fineco export massaged in Excel)
  must NOT touch the review machine: it becomes a private Import Format under an existing `approved`
  platform. Phase 58 makes that *possible* at the data/access layer (D-04); the wizard that *offers*
  it is Phase 59.

</specifics>

<scope_fence>
## Scope Fence

**IN scope (Phase 58 / PLAT-01, PLAT-02, PLAT-03):**
- `platform` schema: drop `visibility`, rename `ownerUserId` → `proposedByUserId`.
- Migration `0023` + idempotent backfill via `scripts/migrate.ts` / `seed-extras` STEP.
- `reviewStatus`-driven platform visibility wiring (`pending`/`approved`).
- `accessibleWhere` relaxation (decouple private format from private platform; remove platform-owner branch).
- No-regression test guard over the hot `platform` join and the existing global formats.
- Minimal, behavior-preserving adaptation of callers of the dropped/renamed columns (wizard write path, validators, seed references).

**OUT of scope — Phase 59 (PLAT-04, `import-wizard-attach-format`):**
- Wizard UX that offers existing platforms and attaches a new private Import Format; "create new platform only if none fits, born `pending`".

**OUT of scope — Phase 60 (PLAT-05, PLAT-06, `seed-slug-linkage-and-docs`):**
- Seed refactor: drop explicit `id:`, link seeded formats by `platformSlug`, resolve slug→id at runtime, fix the Trade Republic id-8 collision.
- DescriptionStripPattern glossary/comment correction (lives on `importFormatVersion` per ADR 0013).

</scope_fence>

<success_criteria>
## Success Criteria (what must be TRUE) — from ROADMAP Phase 58

1. A platform has no `visibility` column; its former `ownerUserId` is now `proposedByUserId` (provenance);
   existing rows are migrated by an additive, idempotent step — no data lost; applied via
   `drizzle-kit generate` + `scripts/migrate.ts` (never `drizzle-kit push` in production).
2. A platform proposed by a user (`reviewStatus = pending`) is visible only to its `proposedByUserId`;
   an `approved` platform (including all seeded platforms) is visible to every user.
3. A user-owned `importFormatVersion` is visible to its owner even when its platform is global/approved —
   `accessibleWhere` no longer requires the platform itself to be private.
4. Existing global formats still resolve and import exactly as before: the hot `platform` join used by
   expenses/transactions/imports for filter/display/sort by `platform.slug` / `platform.name` shows no
   behavioral regression (guarded by tests over the existing formats).

</success_criteria>

<risks>
## Risk Summary

- **Irreversible schema drop.** Dropping `platform.visibility` and renaming `ownerUserId` cannot be
  silently rolled back. The `proposedByUserId` backfill must be idempotent and preserve every existing
  value before `visibility` is dropped.
- **Over-exposure via `accessibleWhere`.** A wrong relaxation could leak private formats or hide global
  ones. Test owner / non-owner / cross-user visibility explicitly (D-04).
- **Build breakage from the column changes.** Wizard, validators, and seed all touch the changed columns;
  missing one yields a compile or runtime error (D-06). Run `yarn check:language` and the type build after.
- **reviewStatus value drift.** `draft` (current wizard) vs `pending`/`approved` (lifecycle) — unify on `pending`.

</risks>

<deferred>
## Deferred Ideas

- **Wizard attach-format UX** → Phase 59 (PLAT-04).
- **Seed slug-linkage + Trade Republic id-8 collision fix** → Phase 60 (PLAT-05).
- **DescriptionStripPattern glossary/comment correction** → Phase 60 (PLAT-06).
- **Operator approval UI ("approve → share")** → deferred by ADR 0015; not built now. For single-user a
  `pending` platform is already visible/usable to its proposer, so the "approve" step doesn't trigger until
  a second user exists.

</deferred>

---

*Phase: 58-platform-identity-and-access*
*Context gathered: 2026-06-29 via ADR Ingest Express Path (manual synthesis — see ingest note)*
