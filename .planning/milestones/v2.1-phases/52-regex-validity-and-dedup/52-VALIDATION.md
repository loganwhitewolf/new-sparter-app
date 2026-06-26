---
phase: 52
slug: regex-validity-and-dedup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts (existing — covers all phase requirements) |
| **Quick run command** | `yarn vitest run tests/<file>.test.ts` |
| **Full suite command** | `yarn vitest run` |
| **Estimated runtime** | ~3 seconds (targeted) / full suite ~minutes |

---

## Sampling Rate

- **After every task commit:** Run the targeted test file for the changed unit
- **After every plan wave:** Run `yarn vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds (targeted)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-XX | TBD | TBD | RDISC-01 (genuine regex family) | — | N/A | unit | `yarn vitest run tests/regex-discovery-service.test.ts` | ❌ W0 | ⬜ pending |
| 52-XX | TBD | TBD | RDISC-02 (single-categorization group) | — | N/A | unit | `yarn vitest run tests/regex-discovery-service.test.ts` | ❌ W0 | ⬜ pending |
| 52-XX | TBD | TBD | RDISC-03 (Check 1 generated-regex coverage) | — | candidate covered by active pattern skipped | unit | `yarn vitest run tests/regex-discovery-service.test.ts` | ❌ W0 | ⬜ pending |
| 52-XX | TBD | TBD | RDISC-04 (Check 2 manual-history dedup) | T-52 read-scope | only the authenticated user's manual history is queried | unit | `yarn vitest run tests/regex-discovery-dal.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs finalized by the planner; this map is the requirement→test contract the planner must satisfy.*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements (vitest configured, Phase 51 test files are direct templates). New test files are created within the implementation tasks, matching the Phase 51 RED/GREEN style — no separate Wave 0 scaffolding needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The four success criteria map directly to unit tests over the discovery service and DAL (real util + real `normalizeDescription`, mocked DAL / `loadActivePatterns`).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
