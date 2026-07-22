# Decision memory

Significant project decisions across sessions. Read at the start of every session. Never contradict an entry without flagging it to the user first.

For tactical retries (commands, tooling), see `ERRORS.md`. For GSD phase-locked decisions, see `.planning/phases/*/*-CONTEXT.md`. For domain vocabulary, see `CONTEXT.md`.

## Entry template (decision)

```markdown
### YYYY-MM-DD — Short title

**Decided:** …

**Why:** …

**Rejected:**
- Option A — …
- Option B — …
```

## Session summary template

Trigger phrases: "session end", "wrapping up", "let's stop here" (see developer-profile rule 7).

```markdown
### YYYY-MM-DD — Session wrap-up

**Worked on:** …

**Completed:** …

**In progress:** …

**Decisions made:** …

**Next session priorities:** …

**GSD refs:** (optional) STATE.md · HANDOFF.json · phase SUMMARY paths
```

---

<!-- Add entries below, newest first -->

### 2026-07-22 — Phase 69 PO winner: Variant C (type-led stack)

**Decided:** Production branding homepage direction = **Variant C** (type-led stack) among the three A+touch-of-B structural variants. Recorded in `app/proto/branding/NOTES.md` (BRAND-02 SoT). Steal: product-plane weight from A; editorial type / asymmetric text from B. Do not ship: A/B as primary homepage layout; no `components/marketing/*` extraction until Phase 71.

**Why:** Explicit PO call after live compare ("mi piace il prototipo 3").

**Rejected:**
- Variant A (shot-as-plane) as primary
- Variant B (editorial split) as primary

### 2026-07-22 — v2.8 branding proto design lock (Phase 69)

**Decided:** Public branding proto direction = **A + touch of B** (dashboard-as-manifesto screenshot + editorial marketing typography). Compare UX = hub `/proto/branding` + `?variant=` switcher (3 structural variants). Winner recorded in `app/proto/branding/NOTES.md`. Full decisions: `.planning/phases/69-proto-design-variants/69-CONTEXT.md`.

**Why:** Cool but credible for Italian personal finance; real product visual builds trust; editorial type differentiates marketing from app chrome without lifestyle fluff.

**Rejected:**
- Pure editorial (B alone) — weak tool credibility
- Three-beat Come funziona homepage (C) — defers to Phase 71 page
- Separate `/proto/branding-a|b|c` as primary compare UX — hub+switcher faster for PO review

### 2026-05-20 — Session wrap-up

**Worked on:** `CLAUDE.md` governance — agent conduct, developer profile, writing style, GSD alignment, portable rules, `MEMORY.md` / `ERRORS.md` workflow.

**Completed:**
- Agent conduct rules 1–7 in `.claude/developer-profile.md` (portable across repos)
- GSD reconciliation for rules 3 (approaches vs execute), 5 (`ERRORS.md` vs SUMMARY/LEARNINGS), 6–7 (`MEMORY.md` vs CONTEXT/HANDOFF/STATE)
- Option B layout: quick reference in `CLAUDE.md` + Sparter-specific detail below
- `.claude/developer-profile.md` — Andrea profile, writing style (ITA/ENG + ENG dev/GSD), tennis not golf
- `ERRORS.md`, `MEMORY.md` created with templates
- Planning paths fixed (`.gsd/` → `.planning/`)
- GSD workflow enforcement block in `CLAUDE.md`

**In progress:** Nothing blocked. Changes are local/uncommitted unless committed separately.

**Decisions made:**
- **CLAUDE.md structure:** Quick reference + project detail; personal rules in `.claude/developer-profile.md` (copy to other repos). Rejected: replacing full file with <500-word bootstrap; rejected: embedding meta-prompt in `CLAUDE.md`.
- **GSD coexistence:** Rule 3 waits for choice outside execute; inside execute follow locked `*-PLAN.md`. Rule 5/6/7 complement GSD artifacts — link, don't duplicate STATE/SUMMARY/HANDOFF.
- **Memory split:** `ERRORS.md` = tactical retries; `MEMORY.md` = decisions + session wrap-ups; `CONTEXT.md` = domain language; `*-CONTEXT.md` = phase-locked GSD decisions.

**Next session priorities:**
- Commit `CLAUDE.md`, `.claude/developer-profile.md`, `MEMORY.md`, `ERRORS.md` if satisfied with the setup
- Copy `developer-profile.md` to dotfiles or next project template
- Optionally log durable decisions from this session as separate `MEMORY.md` decision entries (not just wrap-up)
- Continue adding agent rules if needed; consider `~/.claude/CLAUDE.md` global hook for developer-profile

**GSD refs:** `.planning/STATE.md` (unchanged this session) · no `HANDOFF.json`
