---
phase: 33
slug: pattern-suggestion-detector
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/pattern-suggestion-detector.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/pattern-suggestion-detector.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | SUG-01 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | SUG-02 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-03 | 01 | 1 | SUG-03 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-04 | 01 | 1 | SUG-04 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-05 | 01 | 1 | SUG-05 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-06 | 01 | 1 | SUG-06 | — | Regex metacharacters escaped before setting pattern | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-07 | 01 | 1 | ANL-02 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-08 | 01 | 1 | ANL-04 | — | N/A | unit | `npx vitest run tests/pattern-suggestion-detector.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/pattern-suggestion-detector.test.ts` — stubs for SUG-01 through SUG-06, ANL-02, ANL-04
- [ ] `lib/utils/pattern-suggestions.ts` — implementation skeleton with exported types and function signature

*Both files are new (Wave 0 creates them).*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
