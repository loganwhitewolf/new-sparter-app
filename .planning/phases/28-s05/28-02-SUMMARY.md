---
phase: "28"
plan: "02"
---

# T02: Added an integrated zero-cost production smoke runbook with safe evidence capture and failure triage to the Vercel/Supabase/R2 deployment guide.

**Added an integrated zero-cost production smoke runbook with safe evidence capture and failure triage to the Vercel/Supabase/R2 deployment guide.**

## What Happened

Expanded `docs/deploy/vercel-supabase-r2.md` with a top-level `Integrated production smoke` section that turns the existing migration, deploy, health, registration, preserved-login, R2 CORS, import, and cleanup guidance into one ordered operator checklist. Added a safe evidence table template covering command/action, timestamp, exit code, origin, HTTP status, sanitized health/error fields, and artifact paths while explicitly banning secrets, request bodies, cookies, presigned URLs, object keys, file contents, raw provider/SDK errors, and stack traces from evidence. Added a failure decision tree for production migration safe codes, degraded `/api/health` database/R2 components, stale Vercel env redeploy issues, disabled-registration mismatches, auth origin/cookie issues, R2 presign-versus-CORS/PUT failures, import analysis failures, and free-tier quota/cold-start symptoms. Preserved the existing zero-cost constraints and non-goals: manual local production migrations only, no production `drizzle-kit push`, no deploy-time migration, no migration API route, low pool sizes, free-tier cleanup, and small fake smoke files. Referenced the future T03/T04 smoke harness/specs as optional executable checks that must use the same no-secret evidence contract.

## Verification

Ran the exact task-plan content smoke command against `docs/deploy/vercel-supabase-r2.md`; it verified required terms including `Integrated production smoke`, `db:migrate:production`, `/api/health`, `REGISTRATION_ENABLED`, `registration_disabled`, `R2`, `CORS`, `free-tier`, and `evidence`, and confirmed forbidden sample secret assignments/connection strings were absent. Ran `yarn check:language` after changing developer-facing deployment documentation; it passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python3 - <<'PY'
from pathlib import Path
text = Path('docs/deploy/vercel-supabase-r2.md').read_text()
required = ['Integrated production smoke', 'db:migrate:production', '/api/health', 'REGISTRATION_ENABLED', 'registration_disabled', 'R2', 'CORS', 'free-tier', 'evidence']
missing = [term for term in required if term not in text]
assert not missing, missing
for forbidden in ['PRODUCTION_DATABASE_URL=', 'BETTER_AUTH_SECRET=', 'R2_ACCESS_KEY_ID=', 'R2_SECRET_ACCESS_KEY=', 'postgres://']:
    assert forbidden not in text, forbidden
print('runbook content smoke passed')
PY` | 0 | ✅ pass | 49ms |
| 2 | `yarn check:language` | 0 | ✅ pass | 610ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `docs/deploy/vercel-supabase-r2.md`
