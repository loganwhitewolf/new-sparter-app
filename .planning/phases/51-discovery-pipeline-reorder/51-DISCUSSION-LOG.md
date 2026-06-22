# Phase 51: discovery-pipeline-reorder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 51-discovery-pipeline-reorder
**Areas discussed:** Discovery timing / data source, Service contract, Read scope, Unification, Normalization report

---

## Discovery timing / data source

| Option | Description | Selected |
|--------|-------------|----------|
| Post-categorization on persisted Set B | Discovery runs after categorization writes results, querying persisted uncategorized expenses. Matches PIPE-02 + SC2. | ✓ |
| Analyze-time dry-run categorization | Read-only categorization preview on parsed rows pre-commit; duplicates categorization logic, not on persisted data. | |
| Both: dry-run at analyze + real post-commit | Preview for summary + authoritative post-commit re-run; two code paths to keep consistent. | |

**User's choice:** Post-categorization on persisted Set B
**Notes:** Cascades — service reads persisted data rather than parsed rows. Phase 55 summary reads the post-commit result.

---

## Service contract

| Option | Description | Selected |
|--------|-------------|----------|
| Service reads DB, pure util clusters | `discoverRegexCandidates({ userId, scope })` in lib/services; DAL fetch + pure clustering util (extend detectPatternSuggestions). | ✓ |
| Pure function, caller fetches rows | Service stays pure over passed rows; each caller does its own fetch/normalize. | |

**User's choice:** Service reads DB, pure util clusters
**Notes:** Two Phase 54 entry points call the service; util stays unit-testable.

---

## Read scope

| Option | Description | Selected |
|--------|-------------|----------|
| By file, with platform as optional widening | `{ fileId }` selects the file's uncategorized; `{ platformId }` variant supported, wider path in Phase 53. | |
| By platform from the start | `{ platformId }` always looks at the platform's whole uncategorized history. | ✓ |
| All user uncategorized | No narrowing; ignores platform boundaries the success criteria care about. | |

**User's choice:** By platform from the start
**Notes:** Discovery is platform-bounded. This is the read scope only — the retroactive write scope (APPLY-02) stays deferred to Phase 53.

---

## Unification

| Option | Description | Selected |
|--------|-------------|----------|
| In-app only; CLI convergence deferred | Reorder/extract the in-app path; leave `yarn regex:discover` CLI untouched; record convergence as deferred. | ✓ |
| Unify both onto one clustering core now | Single algorithm for in-app service + CLI; widens scope well beyond PIPE-01/02/03. | |
| In-app now, CLI in a later v2.1 phase | Same as option 1 but committed follow-up phase. | |

**User's choice:** In-app only; CLI convergence deferred
**Notes:** The two implementations use different algorithms (prefix vs token-cluster); CLI is a separate operator workflow.

---

## Normalization report (PIPE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-candidate metadata | Each candidate carries { stablePrefix, strippedByNormalization, residualVariablePart, sampleNormalized }. | ✓ |
| Separate top-level analysis object | Candidates + a separate normalizationReport object. | |
| Both: per-candidate + summary roll-up | Per-candidate fields plus a service-level roll-up for logging. | |

**User's choice:** Per-candidate metadata (option 1)
**Notes:** Feeds the Phase 55 summary UX directly. User also requested all further responses in Italian (existing saved preference).

---

## Claude's Discretion

- Exact module/file naming, DAL query naming, and how the pure util's signature carries the per-candidate metadata.
- Whether the old inline `analyzeFile` `detectPatternSuggestions` call is removed within Phase 51 or kept as harmless dead code until Phase 54/55 wires the new path.

## Deferred Ideas

- Unify the offline `scripts/regex-discovery.ts` CLI onto the in-app clustering core — backlog candidate.
- Retroactive write scope (APPLY-02) — owned by Phase 53.
