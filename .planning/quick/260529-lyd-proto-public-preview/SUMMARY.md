---
quick_id: 260529-lyd
slug: proto-public-preview
date: 2026-05-29
branch: prototype/dashboard-overview
status: complete
commit: c0048e0
---

# Summary: public /proto preview area

## What changed

- Moved `app/(app)/dashboard/overview-prototype/` → `app/proto/overview/` (out of the
  authenticated `(app)` group → no `verifySession`, no onboarding redirect).
- Added `app/proto/layout.tsx`: standalone shell, `notFound()` unless `PROTOTYPES_ENABLED`
  is set, `robots: noindex`. Adjusted the page root height for the standalone shell
  (`h-full` instead of the `(app)`-chrome offset).
- `proxy.ts`: `/proto` exempt from the login redirect (single line; pre-existing phase-38
  WIP in proxy.ts deliberately left unstaged).
- Updated NOTES.md (preview access steps) and CLAUDE.md (Vercel hosting + /proto convention).

## Verification

- `npx tsc --noEmit` — clean on app/proto + proxy.ts.
- `yarn lint app/proto proxy.ts` — clean.
- NOT smoke-tested live (no Vercel access from here). Local check: `PROTOTYPES_ENABLED=1 yarn dev` → `/proto/overview`.

## Scope discipline

Committed only the prototype scope + the single proxy.ts hunk + CLAUDE.md + this task.
Phase-38 WIP (auth.ts, import/onboarding pages, other proxy.ts hunks) and
`.claude/worktrees/` left untouched in the working tree.

## Follow-ups (not in this task)

- Manual: push branch, set `PROTOTYPES_ENABLED` scoped to Preview in Vercel, share preview URL + `/proto/overview` with the PO.
- After the demo: capture the winning variant in NOTES.md, update the `project-dashboard-suite` memory (D024 superseded), plan the real implementation, delete losing variants.
