---
phase: 47
slug: taxonomy-seed-rework
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-11
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.5 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn test tests/seed-taxonomy.test.ts` |
| **Full suite command** | `yarn test` |
| **Build gate** | `yarn build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test tests/seed-taxonomy.test.ts`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite + `yarn build` must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 0 | TAX-01 | — | N/A | unit | `yarn test tests/seed-taxonomy.test.ts` | ✅ | ✅ green |
| 47-01-02 | 01 | 0 | TAX-01 | — | N/A | unit | `yarn test tests/seed-taxonomy.test.ts` | ✅ | ✅ green |
| 47-02-01 | 02 | 1 | TAX-01/TAX-02 | — | N/A | unit | `yarn test tests/seed-taxonomy.test.ts -t "23 active"` | ✅ | ✅ green |
| 47-02-02 | 02 | 1 | TAX-01/TAX-02 | — | N/A | unit | `yarn test tests/seed-taxonomy.test.ts` | ✅ | ✅ green |
| 47-03-01 | 03 | 2 | TAX-01/TAX-02 | — | N/A | unit | `yarn test tests/seed-taxonomy.test.ts` | ✅ | ✅ green |
| 47-03-02 | 03 | 2 | TAX-01/TAX-02 | T-47-03 | N/A | unit | `grep trasferimento-tra-conti + node slug check + yarn test + yarn tsc --noEmit` | ✅ | ✅ green |
| 47-04-01 | 04 | 3 | TAX-02/TAX-03 | T-47-01 | Parameterized SQL only | unit | `grep v2 STEPS + yarn tsc --noEmit` | ✅ | ✅ green |
| 47-04-02 | 04 | 3 | TAX-02/TAX-03 | T-47-01 | Parameterized SQL only | unit | `yarn test tests/seed-extras-steps.test.ts && yarn tsc --noEmit` | ✅ | ✅ green |
| 47-05-01 | 05 | 4 | TAX-03 | — | N/A | unit | `yarn test tests/category-settings-seed.ts` | ✅ | ✅ green |
| 47-05-02 | 05 | 4 | TAX-01/02/03 | — | N/A | integration | `yarn test && yarn build` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/seed-taxonomy.test.ts` — TAX-01/02 static contract (23 categories, slug manifest, natureId 1–8)
- [x] Enable `it.todo` in `tests/category-settings-seed.ts` — R-FN-03
- [x] Optional: `tests/seed-extras-steps.test.ts` — STEPS registry contains `v2-backfill-nature-id`
- [x] Remove `AmountSign` from pattern literals in `seed-data.ts` when patterns updated (D-10)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| seed-extras STEPS on live v1 DB | TAX-02/TAX-03 | No DB in Phase 47 gate (D-05) | Phase 48 dry-run after migrate |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 47 gate green (2026-06-11) — 949 tests + build pass; no DB apply (D-05)
