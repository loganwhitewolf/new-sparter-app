---
phase: "26"
plan: "02"
---

# T02: Expanded the production deployment runbook with Cloudflare R2 setup, CORS, health, smoke-test, redeploy, and free-tier guidance tied to the safe `Content-Type` upload contract.

**Expanded the production deployment runbook with Cloudflare R2 setup, CORS, health, smoke-test, redeploy, and free-tier guidance tied to the safe `Content-Type` upload contract.**

## What Happened

Verified the browser upload and initiate-route code before editing: `app/api/files/initiate/route.ts` returns presigned `PUT` upload headers containing only `Content-Type`, and `components/import/upload-put.ts` forwards those headers to the browser `PUT`. Verified `.env.example` already lists `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and optional `R2_PRESIGNED_UPLOAD_TTL_SECONDS` without misleading client/public R2 guidance, so no env example change was needed. Extended `docs/deploy/vercel-supabase-r2.md` with action-oriented Cloudflare R2 production setup steps, a minimal CORS policy allowing the production HTTPS origin, `PUT`, and `Content-Type`, server-side-only credential/bucket guidance, `/api/health` expectations, stale Vercel env redeploy guidance, a small CSV import smoke procedure, browser/server diagnostic expectations, and free-tier operations hygiene.

## Verification

Ran the required documentation verification command: confirmed the deploy runbook exists, mentions Cloudflare R2, `Content-Type`, and `/api/health`, contains no `NEXT_PUBLIC_R2` or `TODO`/`TBD` placeholders, and passes `yarn check:language`.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f docs/deploy/vercel-supabase-r2.md && grep -q "Cloudflare R2" docs/deploy/vercel-supabase-r2.md && grep -q "Content-Type" docs/deploy/vercel-supabase-r2.md && grep -q "/api/health" docs/deploy/vercel-supabase-r2.md && ! grep -q "NEXT_PUBLIC_R2" docs/deploy/vercel-supabase-r2.md && ! grep -q "TBD\|TODO" docs/deploy/vercel-supabase-r2.md && yarn check:language` | 0 | ✅ pass | 1490ms |

## Deviations

None.

## Known Issues

Prior task `.gsd/milestones/M007/slices/S03/tasks/T01-SUMMARY.md` is an auto-mode recovery placeholder, but the code surfaces needed for this documentation task were present and matched the safe `Content-Type` upload contract.

## Files Created/Modified

- `docs/deploy/vercel-supabase-r2.md`
- `.env.example`
- `components/import/upload-put.ts`
- `app/api/files/initiate/route.ts`
- `lib/services/r2.ts`
