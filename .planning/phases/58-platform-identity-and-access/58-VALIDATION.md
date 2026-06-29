---
phase: 58
slug: platform-identity-and-access
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x |
| **Config file** | repo vitest config (existing) |
| **Quick run command** | `yarn test <file>` (e.g. `yarn test tests/import-private-formats-dal.test.ts`) |
| **Full suite command** | `yarn test` (= `vitest run`) |
| **Estimated runtime** | ~quick per-file; full suite seconds |

---

## Sampling Rate

- **After every task commit:** Run the scoped `yarn test <changed-file>`
- **After every plan wave:** Run `yarn test` (full suite) + `yarn check:language`
- **Before `/gsd-verify-work`:** Full suite green + a generated `0023_*.sql` reviewed for `RENAME COLUMN` (no paired `ADD COLUMN`)
- **Max feedback latency:** < 60 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH.md (Validation Architecture). Planner refines task IDs/commands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-01-01 | 01 | 1 | PLAT-01 | — | `0023_*.sql` is `ALTER TABLE platform RENAME COLUMN owner_user_id TO proposed_by_user_id` with NO paired `ADD COLUMN`; existing `proposedByUserId` values preserved | migration review + data assertion | review `0023_*.sql` + DAL test reading a pre-existing row's `proposedByUserId` | ❌ W0 | ⬜ pending |
| 58-01-02 | 01 | 1 | PLAT-01 | — | `platform.visibility` column and its composite index `platform_visibility_reviewStatus_idx` are dropped; no code references `platform.visibility` | unit / compile | `yarn build` (type) + grep no `platform.visibility` reader | ❌ W0 | ⬜ pending |
| 58-02-01 | — | — | PLAT-02 | — | A `pending` platform is visible only to its `proposedByUserId`; an `approved` platform (incl. all seeded) is visible to every user | unit | `yarn test <platform-visibility-dal.test>` | ❌ W0 | ⬜ pending |
| 58-03-01 | — | — | PLAT-03 | — | Owner sees own private `importFormatVersion` on a global/approved platform; non-owner does NOT; both SQL `accessibleWhere` AND in-memory `isAccessibleImportFormat` agree (lockstep) | unit (visibility matrix) | `yarn test tests/import-private-formats-dal.test.ts` | ✅ (extend existing) | ⬜ pending |
| 58-03-02 | — | — | PLAT-03 / SC4 | — | The 6 existing global formats resolve and import exactly as before; hot `platform` join (filter/display/sort by slug/name) shows no regression | regression | `yarn test` (existing import + imports-list tests) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `tests/import-private-formats-dal.test.ts` (existing Proxy-mock pattern) with the owner / non-owner / cross-user visibility matrix for `accessibleWhere` after relaxation.
- [ ] Add a platform-visibility unit test asserting `pending` → proposer-only, `approved` → all (PLAT-02).
- [ ] Add an assertion that the renamed `proposedByUserId` retains pre-migration values (no data loss).

*Existing vitest infrastructure covers the framework; only the above stubs are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated `0023_*.sql` is a true `RENAME COLUMN` (not drop+add) | PLAT-01 | drizzle-kit emits the SQL interactively; correctness is a human review gate before it ships | After `drizzle-kit generate`, open `drizzle/migrations/0023_*.sql`; confirm exactly one `RENAME COLUMN owner_user_id TO proposed_by_user_id` and NO `DROP COLUMN owner_user_id` + `ADD COLUMN proposed_by_user_id` pair |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
