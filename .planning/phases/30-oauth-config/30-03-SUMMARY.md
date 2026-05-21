---
phase: 30-oauth-config
plan: "03"
subsystem: docs
tags:
  - docs
  - env
  - deploy
  - oauth
dependency_graph:
  requires: []
  provides:
    - ".env.example OAuth section (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)"
    - "docs/deploy/vercel-supabase-r2.md runtime variables table with 4 OAuth rows and callback URL note"
  affects:
    - "auth.ts socialProviders (operator config documentation)"
tech_stack:
  added: []
  patterns:
    - "Commented-out optional env vars pattern (# VAR=) to signal optional-but-documented"
key_files:
  created: []
  modified:
    - .env.example
    - docs/deploy/vercel-supabase-r2.md
decisions:
  - "OAuth vars remain commented out in .env.example to prevent accidental secret commit by copy-paste"
  - "Callback URL pattern documented as {BETTER_AUTH_URL}/api/auth/callback/{provider-id} to generalize across providers"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-21T08:24:42Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
---

# Phase 30 Plan 03: Remove REGISTRATION_ENABLED docs, add OAuth env documentation

Removed all REGISTRATION_ENABLED operator guidance from `.env.example` and `docs/deploy/vercel-supabase-r2.md`; added commented-out OAuth provider section to `.env.example` and four OAuth env var rows plus callback URL pattern note to the deploy runbook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update .env.example — remove REGISTRATION_ENABLED, add OAuth section | 4407a29 | .env.example |
| 2 | Update vercel-supabase-r2.md — purge REGISTRATION_ENABLED, add OAuth runtime vars | ab106f5 | docs/deploy/vercel-supabase-r2.md |
| 3 | Run language gate | (no commit — verification only) | — |

## What Was Removed

### `.env.example`

Lines 49–54 (original numbering) deleted — 6 lines total (1 blank separator + 5-line REGISTRATION_ENABLED block):

```
# Server-side production registration guardrail. Registration is enabled by
# default when this is unset, blank, or malformed. Set to false, 0, no, or off
# to block new signup server-side while keeping existing-user login available.
# Vercel environment changes require a redeploy before runtime behavior changes.
# REGISTRATION_ENABLED=true
```

### `docs/deploy/vercel-supabase-r2.md`

13 removal operations (R1–R13) applied:

- **R1** Step 2: removed `, and \`REGISTRATION_ENABLED\` in Vercel Production` from the variable list sentence
- **R2** Step 7: replaced `With \`REGISTRATION_ENABLED\` unset or true-like and after redeploy,` with `After redeploy,`
- **R3/R4/R5** Deleted Steps 8, 9, 11 in full and renumbered remaining steps (10→8, 12→9, 13→10)
  - Step 8: "Disable registration and redeploy..."
  - Step 9: "Check direct disabled-signup rejection..."
  - Step 11: "Re-enable registration if desired..."
- **R6** Deleted `PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED` row from optional browser smoke variable table
- **R7** Deleted recommended phase sequence item 2 ("After redeploying with `REGISTRATION_ENABLED=false`..."); renumbered item 3 to 2
- **R8** Deleted `disabled direct signup` and `preserved login` rows from safe evidence table
- **R9** Deleted failure decision tree item 5 ("Registration behavior does not match `REGISTRATION_ENABLED`"); renumbered items 6–9 to 5–8
- **R10** Deleted `| \`REGISTRATION_ENABLED\` | No | Optional | ... |` row from Vercel runtime variables table
- **R11** Deleted entire `## Registration toggle smoke and recovery` section (heading + body + minimal checklist, ~20 lines)
- **R12** Removed `, and rely on the S04 registration guardrail to avoid public signup amplification of quota usage` from Small-file R2 import smoke paragraph
- **R13** Deleted `grep -q "REGISTRATION_ENABLED" .env.example` line from no-secret verification bash block

## What Was Added

### `.env.example`

Inserted after `# AUTH_DEBUG=1`, before `# --- Cloudflare R2 storage ---`:

```
# -----------------------------------------------------------------------------
# OAuth providers (optional — activate by adding both vars for a provider)
# -----------------------------------------------------------------------------
# Register at https://console.cloud.google.com/apis/credentials
# Authorized redirect URI: {BETTER_AUTH_URL}/api/auth/callback/google
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# Register at https://github.com/settings/applications/new
# Authorization callback URL: {BETTER_AUTH_URL}/api/auth/callback/github
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
```

All four vars remain commented out (`# VAR=`).

### `docs/deploy/vercel-supabase-r2.md`

**A1** — Inserted 4 rows in the Vercel runtime variables table after `BETTER_AUTH_SECRET`, before `R2_ACCOUNT_ID`:

```
| `GOOGLE_CLIENT_ID` | No | Optional | Google OAuth client ID... Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/google`. |
| `GOOGLE_CLIENT_SECRET` | No | Optional (paired with ID) | Google OAuth client secret. Must be set together with `GOOGLE_CLIENT_ID`. |
| `GITHUB_CLIENT_ID` | No | Optional | GitHub OAuth client ID... Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`. |
| `GITHUB_CLIENT_SECRET` | No | Optional (paired with ID) | GitHub OAuth client secret. Must be set together with `GITHUB_CLIENT_ID`. |
```

**A2** — Inserted callback URL paragraph after the runtime variables table:

```
OAuth callback URLs follow the pattern `{BETTER_AUTH_URL}/api/auth/callback/{provider-id}`. For Google: `.../callback/google`. For GitHub: `.../callback/github`. `BETTER_AUTH_URL` must be set to the correct production HTTPS origin for OAuth redirects to work.
```

## Final Residual-Reference Grep Counts

| Pattern | `.env.example` | `docs/deploy/vercel-supabase-r2.md` |
|---------|---------------|--------------------------------------|
| `REGISTRATION_ENABLED` | 0 | 0 |
| `registration_disabled` | 0 | 0 |
| `disabled-signup` | 0 | 0 |
| `disabled direct signup` | 0 | 0 |
| `PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED` | 0 | 0 |
| `Disable registration` | 0 | 0 |
| `Re-enable registration` | 0 | 0 |
| `S04 registration guardrail` | 0 | 0 |
| `Registration behavior does not match` | 0 | 0 |
| `## Registration toggle smoke and recovery` | 0 | 0 |

| Pattern | `.env.example` | `docs/deploy/vercel-supabase-r2.md` |
|---------|---------------|--------------------------------------|
| `GOOGLE_CLIENT_ID` | 1 | 2 |
| `GOOGLE_CLIENT_SECRET` | 1 | 2 |
| `GITHUB_CLIENT_ID` | 1 | 2 |
| `GITHUB_CLIENT_SECRET` | 1 | 2 |
| `/api/auth/callback/google` | 1 | 1 |
| `/api/auth/callback/github` | 1 | 1 |
| `/api/auth/callback/{provider-id}` | 0 | 1 |

## Deviations from Plan

**1. [Rule 1 - Bug] Duplicate `## Cloudflare R2 production setup` heading introduced during R11**

- **Found during:** Task 2, edit A2
- **Issue:** When applying A2 (insert OAuth paragraph + heading for the following section), the replacement string included `## Cloudflare R2 production setup` but the old string also matched the text body of the old Registration section that had been given that heading title. This created two identical `## ` headings at lines 103 and 123.
- **Fix:** A second edit removed the orphaned Registration section body (lines 103–122) while preserving the correct `## Cloudflare R2 production setup` heading at the original location.
- **Files modified:** docs/deploy/vercel-supabase-r2.md
- **Commit:** ab106f5 (corrected within same task commit)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are documentation-only.

## Self-Check: PASSED

- `.env.example` exists and contains 0 REGISTRATION_ENABLED references, 4 OAuth vars
- `docs/deploy/vercel-supabase-r2.md` exists and contains 0 REGISTRATION_ENABLED references, 4 OAuth var rows, 1 callback URL pattern
- `yarn check:language` exits 0
- Commits 4407a29 and ab106f5 exist in git log
