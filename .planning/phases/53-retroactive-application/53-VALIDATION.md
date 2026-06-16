---
phase: 53
slug: retroactive-application
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (see package.json `test` script) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn vitest run tests/pattern-application.test.ts -x` |
| **Full suite command** | `yarn vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** `yarn vitest run tests/pattern-application.test.ts tests/pattern-actions.test.ts tests/suggestion-card.test.tsx tests/suggestion-promote-form.test.tsx -x`
- **After every plan wave:** `yarn vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | APPLY-02 | T-53-01 | Platform-scoped scan only | unit | `yarn vitest run tests/pattern-application.test.ts -x` | ❌ W0 | ⬜ pending |
| 53-01-02 | 01 | 1 | APPLY-01/02 | — | Returns updatedCount + notUpdatedCount | unit | `yarn vitest run tests/pattern-application.test.ts -x` | ❌ W0 | ⬜ pending |
| 53-02-01 | 02 | 2 | APPLY-01/02 | T-53-02 | Server resolves platform from fileId | unit | `yarn vitest run tests/pattern-actions.test.ts -t promoteSuggestion -x` | ❌ W0 | ⬜ pending |
| 53-03-01 | 03 | 3 | ROADMAP SC-2 | — | Card renders inline counts | unit (UI) | `yarn vitest run tests/suggestion-card.test.tsx -x` | ❌ extend | ⬜ pending |
| 53-03-02 | 03 | 3 | ROADMAP SC-2 | — | Form includes hidden fileId | unit (UI) | `yarn vitest run tests/suggestion-promote-form.test.tsx -x` | ❌ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/pattern-application.test.ts` — platform boundary, matcher dual-test, count semantics
- [ ] Extend `tests/pattern-actions.test.ts` — mock platform apply, assert `applyResult` counts
- [ ] Extend `tests/suggestion-card.test.tsx` — count copy when applyResult present
- [ ] Extend `tests/suggestion-promote-form.test.tsx` — hidden `fileId` input

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end promote on preview | APPLY-01 | Full DB + auth stack | Import Fineco file, promote suggestion, verify expenses categorized across platform history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
