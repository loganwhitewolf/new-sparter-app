---
phase: 73
slug: proto-design-variants
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-22
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> D-09: no automated unit/e2e required beyond runnable pages. Gate on Preview checklist + typecheck/lint.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.5 + Playwright (e2e) — existing; waived for proto UI per D-09 |
| **Config file** | Existing project scripts |
| **Quick run command** | `npx tsc --noEmit` + file existence / grep gates in each PLAN verify |
| **Full suite command** | Same + manual `PROTOTYPES_ENABLED=1` smoke of all three variants |
| **Estimated runtime** | ~30–90 seconds (tsc); manual Preview separate |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` (plans 01–02) or NOTES grep gates (plan 03)
- **After every plan wave:** Local smoke of `/proto/branding?variant=a|b|c` when UI exists
- **Before `/gsd-verify-work`:** Preview URL shared; NOTES.md verdict filled; Production `/proto` still 404
- **Max feedback latency:** ~90 seconds for automated checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------------|-----------|-------------------|-------------|--------|
| 73-01-T1 | 01 | 1 | BRAND-01 | T-73-01..04 | Env gate + noindex preserved; variant whitelist; hardcoded CTAs; no NODE_ENV hide | tsc + grep | see 73-01-PLAN Task 1 verify | ✅ after exec | ⬜ pending |
| 73-01-T2 | 01 | 1 | BRAND-01 | T-73-01 | Scoped font + next/image asset; zero packages | tsc + grep | see 73-01-PLAN Task 2 verify | ✅ after exec | ⬜ pending |
| 73-02-T1 | 02 | 2 | BRAND-01 | T-69-06..09 | VariantB CTAs hardcoded; import-first copy | tsc + grep | see 73-02-PLAN Task 1 verify | ✅ after exec | ⬜ pending |
| 73-02-T2 | 02 | 2 | BRAND-01 | T-69-06..09 | VariantC mounted; three-way hub | tsc + grep | see 73-02-PLAN Task 2 verify | ✅ after exec | ⬜ pending |
| 73-03-T1 | 03 | 3 | BRAND-02 | T-69-10 | NOTES template with Verdetto fields | grep | see 73-03-PLAN Task 1 verify | ✅ after exec | ⬜ pending |
| 73-03-T2 | 03 | 3 | BRAND-02 | T-73-01 | Human fills Winner a\|b\|c; Production 404 confirmed | manual + post-resume grep | `grep -E 'Winner:[[:space:]]*[abcABC]' NOTES.md` | ❌ until PO | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Specless probe fallback: skipped this planning run (`phase_req_ids` null) — recorded in 73-01-PLAN objective; behaviors covered via CONTEXT + REQUIREMENTS must_haves.*

---

## Wave 0 Requirements

- [x] No automated test stubs required (D-09)
- [x] NOTES.md template planned in 73-03 Task 1
- [x] Manual checklist owned by 73-03 human-verify checkpoint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Open hub and switch `?variant=a\|b\|c` | BRAND-01 | Throwaway UI; D-09 | `PROTOTYPES_ENABLED=1 yarn dev`; visit `/proto/branding`; use switcher |
| Production `/proto` 404 | BRAND-01 | Env-scoped Vercel | Confirm Production lacks `PROTOTYPES_ENABLED` |
| Winner recorded | BRAND-02 | Human PO judgment | Fill `app/proto/branding/NOTES.md` after review |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc/lint/grep) or explicit manual accept per D-09
- [ ] Sampling continuity: no 3 consecutive tasks without tsc/lint or manual checklist
- [x] Wave 0: no automated test stubs required
- [x] No watch-mode flags
- [ ] Feedback latency < 90s for automated checks
- [ ] `nyquist_compliant: true` set in frontmatter when validate-phase approves

**Approval:** pending
