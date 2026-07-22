---
phase: 69
slug: proto-design-variants
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> D-09: no automated unit/e2e required beyond runnable pages. Gate on Preview checklist + typecheck/lint.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.5 + Playwright (e2e) — existing; waived for proto UI per D-09 |
| **Config file** | Existing project scripts |
| **Quick run command** | `npx tsc --noEmit` + `yarn lint` (touched `app/proto/**`) |
| **Full suite command** | Same + manual `PROTOTYPES_ENABLED=1` smoke of all three variants |
| **Estimated runtime** | ~30–90 seconds (tsc/lint); manual Preview separate |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` + `yarn lint` for touched proto files
- **After every plan wave:** Same + local smoke of `/proto/branding?variant=a|b|c`
- **Before `/gsd-verify-work`:** Preview URL shared; NOTES.md verdict filled; Production `/proto` still 404
- **Max feedback latency:** ~90 seconds for automated checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01+ | 1+ | BRAND-01 | — | Env gate + noindex via layout | manual + tsc/lint | `PROTOTYPES_ENABLED=1 yarn dev` + browser | ❌ Wave 0 intentional | ⬜ pending |
| TBD | 01+ | 1+ | BRAND-01 | — | Without env → 404 | manual | Visit without env | ✅ layout | ⬜ pending |
| TBD | 01+ | 1+ | BRAND-02 | — | Winner in NOTES.md | manual artifact | Human edit after PO review | ❌ (doc task) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner fills concrete Task IDs when PLAN.md files are written.*

---

## Wave 0 Requirements

- Existing infrastructure covers phase requirements (D-09 waives proto unit tests)
- Optional: NOTES.md template in first implement task (not a test gap)
- Manual checklist in plan SUMMARY: env gate, three variants, switcher, CTAs, no Pricing, Italian copy

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Open hub and switch `?variant=a\|b\|c` | BRAND-01 | Throwaway UI; D-09 | `PROTOTYPES_ENABLED=1 yarn dev`; visit `/proto/branding`; use switcher |
| Production `/proto` 404 | BRAND-01 | Env-scoped Vercel | Confirm Production lacks `PROTOTYPES_ENABLED` |
| Winner recorded | BRAND-02 | Human PO judgment | Fill `app/proto/branding/NOTES.md` after review |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc/lint) or explicit manual accept per D-09
- [ ] Sampling continuity: no 3 consecutive tasks without tsc/lint or manual checklist
- [ ] Wave 0: no automated test stubs required
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s for automated checks
- [ ] `nyquist_compliant: true` set in frontmatter when validate-phase approves

**Approval:** pending
