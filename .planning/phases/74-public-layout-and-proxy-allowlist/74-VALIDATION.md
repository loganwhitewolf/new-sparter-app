---
phase: 74
slug: public-layout-and-proxy-allowlist
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn vitest run tests/proxy-auth.test.ts` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~5–30 seconds (proxy file); full suite longer |

---

## Sampling Rate

- **After every task commit:** Run `yarn vitest run tests/proxy-auth.test.ts`
- **After every plan wave:** Run `yarn test` (or at least proxy + any new public component tests)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 74-01-01 | 01 | 1 | BRAND-04 | T-74-01 | Anon `/` not 307→login; deny-by-default for gated paths | unit | `yarn vitest run tests/proxy-auth.test.ts` | ❌ W0→task | ⬜ pending |
| 74-01-01 | 01 | 1 | BRAND-05 | T-74-05 | Auth `/` → `/dashboard` only (fixed dest) | unit | `yarn vitest run tests/proxy-auth.test.ts` | ❌ W0→task | ⬜ pending |
| 74-01-01 | 01 | 1 | BRAND-03 | T-74-02 | Auth `/how-it-works` → 200 (not AUTH bounce) | unit | `yarn vitest run tests/proxy-auth.test.ts` | ❌ W0→task | ⬜ pending |
| 74-01-01 | 01 | 1 | BRAND-04 | T-74-01 | Anon `/dashboard` still 307→login | unit | `yarn vitest run tests/proxy-auth.test.ts` | ✅ | ⬜ pending |
| 74-01-01 | 01 | 1 | BRAND-04 | T-74-04 | `next-action` passthrough | unit | `yarn vitest run tests/proxy-auth.test.ts` | ✅ | ⬜ pending |
| 74-01-02 | 01 | 1 | BRAND-03 | — | `(public)` has no app-shell / sidebar-provider / dal-auth imports | static | grep under `app/(public)` | ❌ | ⬜ pending |
| 74-02-01 | 02 | 2 | BRAND-03 | T-74-07 | SiteHeader Sheet + named route constants | static | file/grep gates in 74-02-PLAN | ❌ | ⬜ pending |
| 74-02-02 | 02 | 2 | BRAND-03 | T-74-07 | SiteFooter Dashboard (D-08) + layout wire | static | file/grep + proxy regression | ❌ | ⬜ pending |
| 74-03-01 | 03 | 3 | BRAND-03 | T-74-10 | Stub pages D-10 copy only | static | file/grep + proxy regression | ❌ | ⬜ pending |
| 74-03-02 | 03 | 3 | BRAND-03 | — | Human chrome + smart-root UX | manual | checkpoint:human-verify | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Wave 0 D-07 cases are authored inside Plan 01 Task 1 (tracer) — no separate Wave 0 plan.*

---

## Wave 0 Requirements

- [x] Covered by Plan 01 Task 1: extend `tests/proxy-auth.test.ts` with D-07 cases (anon `/`, auth `/`, auth `/how-it-works`, keep gated-path regression)
- [ ] Optional: unit test for `isPublicPath` / membership helpers if exported from `lib/routes.ts`
- [x] No new framework install required

*Existing infrastructure covers the harness; gaps are test cases only (shipped in tracer).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `(public)` layout has header/nav/footer; no AppShell/sidebar/onboarding | BRAND-03 | No forbid-import ESLint rule for AppShell in `(public)` | Visit anon `/` and `/how-it-works`; confirm marketing chrome; confirm no sidebar (Plan 03 checkpoint) |
| Stub pages show “Contenuto in arrivo.” + Torna alla home | BRAND-03 / D-10 | Copy smoke, not proxy contract | Open `/privacy`, `/terms`, `/how-it-works` as anon |
| Homepage shell: brand + supporting line + Registrati/Entra CTAs | BRAND-05 / D-11 | Visual shell per UI-SPEC | Anon `/` matches 74-UI-SPEC minimal shell |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
