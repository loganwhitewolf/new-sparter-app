# Requirements — Milestone v2.3: Platform Identity & Format Ownership

**Defined:** 2026-06-29
**Decision contract:** LOCKED — `docs/adr/0015-platform-global-moderated-format-private.md` + `CONTEXT.md` (Platform / Import Format glossary entries)

**Goal:** Make Platform a globally shared, moderated identity (never user-owned) and move private ownership onto the Import Format, eliminating duplicate platforms and the seed id collision.

---

## v2.3 Requirements

### Platform Identity Model

- [x] **PLAT-01**: A Platform is never user-owned. `platform.visibility` is removed and `platform.ownerUserId` is renamed to `proposedByUserId` (provenance, not ownership). Existing rows are migrated by an additive, idempotent step — migration via `drizzle-kit generate` + `scripts/migrate.ts`; never `drizzle-kit push` in production.
- [ ] **PLAT-02**: Platform visibility follows a review lifecycle keyed on `reviewStatus`: a user-proposed Platform is `pending` and visible **only** to its `proposedByUserId`; an `approved` Platform is visible to **all** users. Seeded platforms remain `approved`.
- [ ] **PLAT-03**: A private Import Format is decoupled from a private Platform. A user-owned `import_format_version` (`ownerUserId = user`) is visible to its owner **even when attached to a global/approved Platform** — `accessibleWhere` no longer requires the platform to also be private. No behavioral regression for the existing global formats.

### Import Wizard

- [ ] **PLAT-04**: When format detection fails on upload, the user can attach a new private Import Format to an **existing** Platform. A brand-new Platform is created only when no existing one fits, and it is created `pending`. The wizard no longer silently mints a duplicate Platform for a known bank.

### Seed Integrity

- [ ] **PLAT-05**: Seeded import formats reference their Platform by **slug** (no hardcoded platform id); `seed.ts` resolves slug→id at runtime and seeded platforms carry no explicit `id`. The Trade Republic id-8 collision (seed skipped by `onConflictDoNothing` when a user platform already holds id 8) no longer occurs. The runtime FK stays `import_format_version.platformId`.

### Documentation

- [ ] **PLAT-06**: The DescriptionStripPattern reference is corrected wherever stale — the CONTEXT.md glossary (and any stale code comments) state it lives on `import_format_version` (ADR 0013), not `platform`.

## Future Requirements (deferred)

- Operator approval UI to promote a `pending` Platform to `approved` — needed only once a second user exists; until then `pending` + proposer-visible is fully functional for import.
- Multi-user identity dedup: two users proposing the same bank converge onto one `approved` Platform.

## Out of Scope

- Operator deploy (R038/R039/R041) — an operational action, not a build item for this milestone.
- Trade Republic auto-categorization — a separate `regex-discovery` + `seed-patterns` follow-up, independent of the platform model.
- Changing the runtime FK from `platformId` to `platformSlug` — rejected (hot join across expenses/transactions/imports; natural-key cascade cost). Slug is the seed-linkage key only.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PLAT-01 | Phase 58 | ⬜ Pending |
| PLAT-02 | Phase 58 | ⬜ Pending |
| PLAT-03 | Phase 58 | ⬜ Pending |
| PLAT-04 | Phase 59 | ⬜ Pending |
| PLAT-05 | Phase 60 | ⬜ Pending |
| PLAT-06 | Phase 60 | ⬜ Pending |
