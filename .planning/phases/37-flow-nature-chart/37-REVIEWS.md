---
phase: 37
reviewers: [codex]
attempted_reviewers: [codex, opencode, cursor]
reviewed_at: 2026-05-26T10:30:00Z
plans_reviewed:
  - 37-01-PLAN.md
  - 37-02-PLAN.md
  - 37-03-PLAN.md
  - 37-04-PLAN.md
  - 37-05-PLAN.md
reviewer_notes:
  opencode: "Failed — credit limit exceeded on configured OpenRouter key (moonshotai/kimi-k2.6)"
  cursor: "Failed — authentication required (agent login not configured)"
  claude: "Skipped — running inside Claude Code (independence rule)"
---

# Cross-AI Plan Review — Phase 37 (flow-nature-chart)

## Codex Review

**Summary**

Overall, the plans were well-structured and mostly sequenced correctly: schema and shared vocabulary first, DAL second, UI last. The plans did a good job preserving existing dashboard behavior, calling out algebraic sums, excluding transfers through `excludeFromTotals`, and using RED test scaffolds to drive later waves. The main weaknesses were a few plan-level contradictions and missing hardening details: `null` was overloaded as both "unclassified" and "inherit default," Wave 1 had an undeclared dependency, the chart plan had a likely data-shape mismatch, and the settings override action needed an explicit authorization requirement beyond `verifySession()`.

**Strengths**

- Clear vertical slicing: utility/schema → DAL → chart/settings UI was the right broad sequence.
- Good protection of existing behavior: `getAggregatedTransactionsData`, `MonthlyTrendPoint`, and `BilancioBarsChart` were explicitly left unchanged.
- Strong domain decisions: algebraic `SUM(amount)`, no new transfer nature, and `excludeFromTotals` for transfers were correctly specified.
- Good shared vocabulary: `FlowNature`, labels, order, and colors were centralized early.
- Strong handoff quality from DAL to UI: later plans knew they depended on `getMonthlyTrendByNature` and `effectiveNature`.
- Test intent was better than average: utility tests, DAL builder tests, chart tests, action tests, and seed coverage were all called out.

**Concerns**

- **HIGH — `null` semantics are contradictory.** Plan 37-05 says selecting `Non classificato` stores `nature=null`, but the DAL uses `COALESCE(override.nature, sub_category.nature)`, so `null` means "inherit seed default," not "unclassified." This prevents users from explicitly forcing a seeded subcategory to unclassified.

- **HIGH — Missing authorization detail for nature overrides.** `verifySession()` proves identity, but the plan should require checking that the `subCategoryId` is system-visible or owned by the current user before upserting an override. *(Note: this was caught and fixed in the post-implementation code review as CR-01.)*

- **HIGH — Plan 37-04 likely mismatched chart data shape.** The DAL type stores values under `segments`, but the chart plan says `<Bar dataKey={key}>`. Unless the component flattens rows first, Recharts would need `dataKey="segments.essential"` or equivalent.

- **HIGH — Wave 1 dependency leak.** Plan 37-02 has `depends_on: []` but tells the implementer to read `lib/utils/nature-labels.ts`, which is created by Plan 37-01 in the same wave. Either 37-02 should depend on 37-01, or both should derive values from the phase context independently.

- **MEDIUM — Migration/seed verification was under-specified.** The plan mentioned generated/applied migrations, but the task verification leaned on `tsc`. Future plans should require `drizzle-kit` validation plus migrate/seed against a clean database or a test database.

- **MEDIUM — `totalNc` / `totalIgn` aggregation was ambiguous.** "Max or sum as existing helper does" is too loose for grouped-by-nature rows and risks double-counting monthly totals. *(Note: this was caught and fixed post-implementation as WR-01.)*

- **MEDIUM — Next.js 16 project rule was not reflected.** Frontend/server-action plans should explicitly include reading the relevant `node_modules/next/dist/docs/` guide before touching router/search params/server actions.

- **MEDIUM — Chart URL and accessibility edge cases needed more detail.** Unknown `hidden` values, stable param ordering, preserving existing query params, keyboard-accessible legend toggles, and `aria-pressed` should have been explicit.

- **LOW — Acceptance checks used brittle heuristics.** `grep -c export`, exact line counts, and `min_lines` are weak signals compared with type-level assertions and behavior tests.

**Suggestions**

- Model override state explicitly: use `inherit`, concrete nature values, and optionally `unclassified` as distinct UI/API concepts, then map deliberately to storage.
- Add authorization acceptance criteria to every server action that accepts an entity id.
- Require each plan to declare every artifact dependency, even if it is in the same wave.
- For chart plans, specify the exact render data shape handed to Recharts.
- Add one integration-style DAL test covering override precedence, excluded transfers, null nature, and algebraic positive/negative sums together.
- Add a migration/seed verification checklist for schema phases.
- Prefer behavior-based acceptance criteria over grep or file-size checks.

**Risk Assessment**

**HIGH** plan risk if followed literally. The overall structure was strong, but the `null`/inherit contradiction, missing explicit ownership authorization, undeclared Wave 1 dependency, and chart data-key mismatch were significant enough to threaten correctness, security, or primary UI delivery.

---

## Consensus Summary

*(Single reviewer — codex only. OpenCode failed due to credit limit; Cursor requires authentication setup.)*

### Agreed Strengths

- Wave ordering (utility → schema → DAL → UI) was correct and well-sequenced
- Algebraic sum approach and transfer exclusion were correctly specified from the start
- Shared vocabulary (FlowNature, NATURE_LABELS, etc.) centralized early

### Agreed Concerns (HIGH priority for future phases)

1. **`null` overloading** — when `null` means both "inherit seed default" (DB COALESCE) and "unclassified" (UI sentinel), the plan should make this mapping explicit and document the UX implication clearly
2. **Ownership authorization in server actions** — any action accepting an entity `id` from client input must explicitly require an ownership/visibility check in the plan's must_haves, not just `verifySession()`
3. **Same-wave dependency declarations** — if Plan B in Wave N reads files produced by Plan A in Wave N, that is still a dependency and must be declared

### Divergent Views

N/A — single reviewer.

### Carry-forward to future phases

These findings are filed as planning feedback for future phase reviews:
- Every schema phase needs a migration verification checklist (apply + migrate against real DB, not just tsc)
- Chart plans must specify exact `dataKey` → data shape mapping before implementation
- Acceptance criteria should be behavior-based, not file-size/grep-based
