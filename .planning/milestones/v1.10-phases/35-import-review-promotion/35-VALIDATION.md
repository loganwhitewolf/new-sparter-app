---
phase: 35
slug: import-review-promotion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` — includes `tests/**/*.test.ts`, `tests/**/*.test.tsx`, `lib/**/*.test.ts`; excludes `*.spec.ts` (Playwright) |
| **Quick run command** | `yarn test -- tests/pattern-actions.test.ts tests/import-preview-ui.test.tsx tests/import-analyze-page.test.tsx` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test -- tests/pattern-actions.test.ts tests/import-preview-ui.test.tsx`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 0 | REV-03 | T-35-01 | userId from session, not FormData (IDOR prevention) | unit | `yarn test -- tests/pattern-actions.test.ts` | ❌ W0 extend | ⬜ pending |
| 35-01-02 | 01 | 0 | REV-01 | — | N/A | unit | `yarn test -- tests/import-preview-ui.test.tsx` | ❌ W0 extend | ⬜ pending |
| 35-01-03 | 01 | 0 | REV-04 | — | N/A | unit | `yarn test -- tests/import-preview-ui.test.tsx` | ❌ W0 extend | ⬜ pending |
| 35-01-04 | 01 | 0 | REV-02 | — | N/A | unit | `yarn test -- tests/suggestion-card.test.tsx` | ❌ W0 new | ⬜ pending |
| 35-01-05 | 01 | 0 | REV-05 | — | N/A | unit | `yarn test -- tests/suggestion-promote-form.test.tsx` | ❌ W0 new | ⬜ pending |
| 35-01-06 | 01 | 1 | REV-01..05 | — | N/A | unit | `yarn test -- tests/import-analyze-page.test.tsx` | ❌ W0 extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/pattern-actions.test.ts` — add `promoteSuggestionAction` describe block (covers REV-03, D-03 no-gate bypass)
- [ ] `tests/import-preview-ui.test.tsx` — add REV-01 (section present/absent), REV-04 (confirm unblocked); update `baseResult` fixture to include `categories` prop
- [ ] `tests/import-analyze-page.test.tsx` — add `getCategories` mock; update `analysisResult()` factory to include `patternSuggestions: []`; add test: categories prop forwarded to ImportPreview
- [ ] `tests/suggestion-card.test.tsx` — new file covering REV-02 (sample toggle default-hidden, toggle shows/hides) and promoted state visual
- [ ] `tests/suggestion-promote-form.test.tsx` — new file covering REV-05 (success badge shown, Alert shown on error, via useActionState)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Suggestion cards render in real import UI with live DB data | REV-01 | Requires real uploaded file + DB | Upload a CSV with transactions matching existing patterns; verify cards appear |
| Select populates subcategories from real DB | REV-03 | DB data required | Verify Select options match DB subcategories for the user |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
