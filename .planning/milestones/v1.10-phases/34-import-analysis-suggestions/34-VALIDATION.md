---
phase: 34
slug: import-analysis-suggestions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn test -- --reporter=verbose tests/import-service.test.ts` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test -- --reporter=verbose tests/import-service.test.ts`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 0 | ANL-01, ANL-03, ANL-05 | T-34-01 | Detection failure returns `[]`, no stack trace leak | unit | `yarn test -- tests/import-service.test.ts` | ✅ (new cases in existing file) | ⬜ pending |
| 34-02-01 | 02 | 1 | ANL-01 | — | N/A | unit | `yarn test -- tests/import-service.test.ts` | ✅ | ⬜ pending |
| 34-02-02 | 02 | 1 | ANL-03 | — | N/A | unit | `yarn test -- tests/import-service.test.ts` | ✅ | ⬜ pending |
| 34-02-03 | 02 | 1 | ANL-05 | T-34-01 | Detection failure isolated, returns `[]` | unit | `yarn test -- tests/import-service.test.ts` | ✅ | ⬜ pending |
| 34-02-04 | 02 | 1 | SCOP-01, SCOP-02 | — | No DB writes; only current rows fed | unit | `yarn test -- tests/import-service.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/import-service.test.ts` — add `vi.mock('@/lib/utils/pattern-suggestions', …)` block with `detectPatternSuggestions` mock
- [ ] `tests/import-service.test.ts` — stubs for ANL-01 (field present), ANL-03 (capped + ranked), ANL-05 (failure isolation)

*These cases go into the existing file; no new test file needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Analysis failures do not leak R2 keys or presigned URLs in error response | ANL-05 | Cannot be asserted via unit test alone | Trigger a forced detection error, confirm response body has no `r2Key`, `presignedUrl`, or raw row fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
