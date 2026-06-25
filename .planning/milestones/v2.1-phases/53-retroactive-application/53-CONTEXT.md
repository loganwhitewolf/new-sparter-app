# Phase 53: retroactive-application - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning
**Source:** Discuss-phase checkpoint (`.planning/phases/53-retroactive-application/53-DISCUSS-CHECKPOINT.json`)

<domain>
## Phase Boundary

When the user promotes a discovered regex candidate into a saved pattern, the system **immediately retroactively categorizes** matching uncategorized expenses — without re-import — and surfaces an **observable apply result** inline on the suggestion card.

Delivers requirements **APPLY-01, APPLY-02** only. This phase does not add discovery triggers (Phase 54), import-summary UX (Phase 55), or validity/dedup changes (Phase 52).

**Hard constraints (from ROADMAP success criteria):**
- Applying a regex never re-touches already-categorized transactions (Set A).
- When scope is platform-bounded, retroactive apply never crosses into another platform's history.
- The user can observe exactly how many existing transactions were updated vs left unchanged within the resolved apply scope.

</domain>

<decisions>
## Implementation Decisions

### Retroactive write scope (APPLY-02 — RESOLVED)
- **Decision: apply to the entire uncategorized history for the same platform** — not current-file-only, not two explicit user-selectable modes.
- Aligns with Phase 51 **D-03** discovery *read* scope: platform-bounded Set B via `expense → file → importFormatVersion → platform`.
- The promotion entry point must resolve **which platform** the suggestion belongs to (from the surrounding file/import context) and pass `platformId` into the apply path.
- **Rejected alternatives:** current file only; dual explicit modes (user picks scope at promote time).

### Observable apply result (ROADMAP SC-2)
- **Decision: show separated counts** — `updatedCount` and `notUpdatedCount` — **not** a per-transaction list.
- Count semantics within the resolved apply scope (platform uncategorized Set B):
  - **updated:** expenses that matched the new regex and were categorized.
  - **not updated:** expenses still uncategorized after apply because the regex did not match (same scope, no match).
- Expenses outside the apply scope (other platforms, already categorized) are **not** included in either count.
- **Rejected alternatives:** updated-only; per-transaction detail rows.

### Feedback placement (UX)
- **Decision: inside the suggestion card, at the action point** — immediately where the user clicked "Crea pattern".
- **Rejected alternatives:** global toast/banner; dedicated post-action summary page.

### Feedback persistence (UX)
- **Decision: persist in the card while the page is open** — counts remain visible after success until navigation/refresh.
- The card may show the existing "Pattern creato" success state **plus** the apply counts; do **not** remove or fully disable the card on success (that option was explicitly rejected).
- **Rejected alternatives:** temporary auto-dismiss feedback; persist and remove/disable the promoted card.

### Service / action contract
- Extend `applyNewPatternToExpenses` (or a thin Phase 53 wrapper) to accept **`platformId`** and restrict the scan to platform-scoped Set B — reuse the same join/filter semantics as `getUncategorizedExpensesForDiscovery` in `lib/dal/regex-discovery.ts`.
- Return a structured result `{ updatedCount, notUpdatedCount }` (exact shape at planner's discretion) instead of only `number`.
- **`promoteSuggestionAction`** is the primary integration surface: accept `platformId` from the client (hidden field on the promote form), call the scoped apply, return counts in `ActionState`.
- **`createPatternAction`** (settings pattern form) is **out of scope** unless research shows it must share the same helper for consistency; it currently calls the legacy platform-agnostic apply and is not part of the discovery promotion flow.

### Matcher fidelity
- Retroactive matching must stay consistent with Tier-1 / suggestion-generated patterns: test both full normalized title and numeric-stripped form (existing behavior in `pattern-application.ts` lines 54–60). Do not regress this when adding platform scope.

### Claude's Discretion
- Exact `ActionState` extension, Italian copy for the inline count message, and whether to refactor `applyNewPatternToExpenses` in place vs add `applyNewPatternToPlatformExpenses`.
- How `platformId` is threaded from Phase 54-ready discovery surfaces vs the legacy `/import/[fileId]/suggestions` page (file → platform resolution).
- Whether `notUpdatedCount` is computed in one pass (scan count − updated) or explicitly counted — implementation detail as long as semantics hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / milestone definition
- `.planning/ROADMAP.md` §"Phase 53: retroactive-application" — goal, success criteria 1–3.
- `.planning/REQUIREMENTS.md` — APPLY-01/APPLY-02 (APPLY-02 scope now locked to platform history).
- `.planning/phases/53-retroactive-application/53-DISCUSS-CHECKPOINT.json` — raw discuss answers.

### Upstream phase context (scope alignment)
- `.planning/phases/51-discovery-pipeline-reorder/51-CONTEXT.md` — D-03 platform-scoped discovery read scope.
- `.planning/phases/52-regex-validity-and-dedup/52-CONTEXT.md` — discovery output shape; no retroactive work in Phase 52.

### Retroactive apply + promotion path
- `lib/services/pattern-application.ts` — `applyNewPatternToExpenses` (today: user-wide uncategorized, returns `number`).
- `lib/actions/patterns.ts` — `promoteSuggestionAction`, `createPatternAction` (both call apply today; promote is in-scope).
- `lib/dal/regex-discovery.ts` — `getUncategorizedExpensesForDiscovery(userId, platformId)` — authoritative platform-scoped Set B query to mirror for writes.
- `lib/validations/pattern.ts` — `ActionState` (extend for apply counts).

### Suggestion UI (feedback surface)
- `components/import/suggestion-promote-form.tsx` — promote form + `useActionState`.
- `components/import/suggestion-card.tsx` — card shell, "Pattern creato" badge, post-promote disabled form.
- `components/import/suggestion-section.tsx` — list wrapper.
- `app/(app)/import/[fileId]/suggestions/page.tsx` — current post-import suggestions page (legacy detector path until Phase 54/55).

### Domain language
- `CONTEXT.md` (repo root) — Transaction vs Expense, categorization tiers, descriptionHash.

</canonical_refs>

<code_context>
## Existing Code Insights

### Current gap (must change)
- `applyNewPatternToExpenses` selects **all** user uncategorized expenses (`userId` + `subCategoryId IS NULL`) with **no platform filter** — violates the locked APPLY-02 decision and ROADMAP SC-3.
- `promoteSuggestionAction` returns only `{ error: null }` on success — no apply counts for inline card feedback.
- `SuggestionCard` shows a generic "Pattern creato" badge via client state; no server-returned apply statistics.

### Reusable assets
- Platform-scoped Set B query already exists: `getUncategorizedExpensesForDiscovery` — mirror its join chain for the apply scan (or extract shared DAL helper if duplication is risky).
- Classification history write loop in `applyNewPatternToExpenses` (`source: 'user_pattern'`) — keep for updated rows.
- `SuggestionPromoteForm` / `useActionState` pattern — extend state shape rather than adding parallel fetch.

### Established patterns
- Layered architecture: scope/filter logic in `dal` or `services`, thin `promoteSuggestionAction`.
- Promotion available on all plans (see D-03 comment in `promoteSuggestionAction`); do not add plan gates in this phase.
- Apply failures after pattern save are logged but non-fatal today — preserve or tighten explicitly in plan; counts should reflect actual updates.

### Integration points
- Hidden `platformId` on promote form — resolved server-side from file context where possible; validate ownership.
- Phase 54 will invoke discovery + promotion from additional surfaces; scoped apply must accept `platformId` from any entry point that promotes a discovered regex.
- Phase 55 summary UX is separate; inline card counts are not a substitute for SUMUI.

</code_context>

<specifics>
## Specific Ideas

- Verification anchor: promote a Fineco suggestion from a file on Fineco platform → expenses matching the regex **across that platform's uncategorized history** update; expenses on Revolut (or already categorized) do not; card shows e.g. "3 categorizzate · 12 ancora senza match" (Italian product copy — exact strings at implementer's discretion).
- Unit/integration tests should cover: platform boundary, Set A untouched, matcher still hits numeric-stripped titles, action returns counts, UI renders counts after promote.

</specifics>

<deferred>
## Deferred Ideas

- Dual explicit apply modes (file vs platform) — rejected in discuss; do not re-open.
- Global toast/banner or dedicated post-promote summary page — rejected in discuss.
- Auto-removing the promoted suggestion card — rejected in discuss.
- `createPatternAction` platform-scoped retroactive apply — not required for discovery promotion; revisit only if planner finds user confusion from inconsistent settings-form behavior.
- Discovery trigger wiring (post-import auto-run, Files-table on-demand) → Phase 54.
- Import summary capped examples + regex vs single-categorization separation → Phase 55.

</deferred>

---

*Phase: 53-retroactive-application*
*Context gathered: 2026-06-16 via discuss-phase checkpoint recovery*
