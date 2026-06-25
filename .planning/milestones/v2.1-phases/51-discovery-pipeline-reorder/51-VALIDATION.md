---
phase: 51
slug: discovery-pipeline-reorder
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-16
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` (mocks `server-only` via alias → `tests/__mocks__/server-only.ts`) |
| **Quick run command** | `npx vitest run <single test file>` |
| **Full suite command** | `yarn test` (= `vitest run`) |
| **Estimated runtime** | ~3–8 seconds (single file); full suite tens of seconds |

No Wave 0 framework install needed — vitest is already configured and the `server-only`
alias mock already exists, so DAL/service modules carrying the `server-only` guard are
importable in tests without further setup.

---

## Sampling Rate

- **After every task commit:** Run the task's `npx vitest run <file>` quick command.
- **After every plan wave:** Run `yarn test` (full suite).
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** < 10 seconds (single-file quick run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | PIPE-03 | T-51-01 / T-51-02 | Pure transform; no server-only guard; no regex from untrusted free text | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ✅ (existing) | ⬜ pending |
| 51-01-02 | 01 | 1 | PIPE-03 | — | D-05 metadata fields populated | unit | `npx vitest run tests/pattern-suggestion-detector-meta.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 51-02-01 | 02 | 1 | PIPE-01 | T-51-03 / T-51-04 / T-51-05 | Set B only; userId + platformId scope; server-only | unit | `npx vitest run tests/regex-discovery-dal.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 51-02-02 | 02 | 1 | PIPE-01 | T-51-03 / T-51-04 | WHERE asserts Set B + cross-user/cross-platform exclusion | unit | `npx vitest run tests/regex-discovery-dal.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 51-03-01 | 03 | 2 | PIPE-02, PIPE-03 | T-51-06 / T-51-07 / T-51-08 | Standalone (no import ctx); strip before cluster; server-only | unit | `npx vitest run tests/regex-discovery-service.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 51-03-02 | 03 | 2 | PIPE-01, PIPE-02, PIPE-03 (SC-4) | T-51-06 | Fineco DoD survives as Set B → one candidate; coverage filter excludes Set A | unit | `npx vitest run tests/regex-discovery-service.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 51-03-03 | 03 | 2 | PIPE-01 | T-51-09 | Comment-only edit; legacy summary unchanged | unit (regression) | `npx vitest run tests/import-service.test.ts` | ✅ (existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Each test file is created by the same task whose behavior it verifies (TDD: test authored
alongside the unit). No task depends on a test file authored by a later task, so there is no
Wave 0 scaffolding gap — the test infra (vitest + server-only mock) already exists.

---

## Wave 0 Requirements

- [x] Test framework present — vitest 4.x configured in `vitest.config.ts`.
- [x] `server-only` mock present — `tests/__mocks__/server-only.ts` (aliased in vitest config), so DAL/service modules are importable in tests.
- [x] Analog tests exist to copy from — `tests/pattern-suggestion-detector.test.ts` (pure util), `tests/expenses-dal.test.ts` (mocked db query chain), `tests/import-service.test.ts` (hoisted service mocks).

*All MISSING test files are created within the task that implements the behavior they verify; no separate Wave 0 scaffolding plan is required.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* This phase is backend service code with no
UI surface; every success criterion (SC-1 Set B only, SC-2 standalone service, SC-3
normalization report, SC-4 Fineco DoD) maps to a unit test in the map above.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (none — infra pre-exists)
- [x] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-16
