---
phase: 55
slug: import-summary-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn test --run` |
| **Full suite command** | `yarn test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test --run`
- **After every plan wave:** Run `yarn test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | SUMUI-01 | — | N/A | unit/render | `yarn test --run` | ✅ | ⬜ pending |
| 55-01-02 | 01 | 1 | SUMUI-01 | — | N/A | unit | `yarn test --run` | ✅ | ⬜ pending |
| 55-02-01 | 02 | 2 | SUMUI-02 | — | N/A | unit/render | `yarn test --run` | ✅ | ⬜ pending |
| 55-03-01 | 03 | 2 | SUMUI-03 | — | N/A | unit/render | `yarn test --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Il cap 10 righe è visivo nella analyze page | SUMUI-01 | Rendering in browser | Importare un file con >10 transazioni, verificare che la tabella mostri ≤10 righe |
| La separazione dei gruppi è chiara | SUMUI-02 | Visual UX | Verificare heading + intro text per entrambi i gruppi nella suggestions page |
| Il paragrafo SUMUI-03 è visibile | SUMUI-03 | Visual UX | Verificare che il sotto-titolo descrittivo appaia sotto `h1 "Suggerimenti pattern"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
