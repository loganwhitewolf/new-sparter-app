---
status: complete
phase: 02-authentication
source: [02-00-SUMMARY.md, 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-04-25T00:00:00Z
updated: 2026-04-27T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start — DB migration applied and app boots
expected: Set DATABASE_URL in .env.local (Railway/Postgres or local Postgres). Run: npm run db:migrate. Then: npm run dev. Server starts without errors, http://localhost:3000/login loads (200 OK, no crash).
result: pass

### 2. Registration happy path
expected: Go to http://localhost:3000/register. Enter a valid email and password (8+ chars). Click "Registrati". Expected: redirected to http://localhost:3000/dashboard.
result: pass

### 3. Login + session persistence
expected: Go to http://localhost:3000/login. Enter credentials from Test 2. Click "Accedi". Expected: redirected to /dashboard. Then refresh (F5) — expected: still on /dashboard (not redirected to /login).
result: pass

### 4. Topbar shows session email
expected: After login, open the avatar dropdown in the top-right corner. Expected: email address is shown (not the hardcoded "utente@example.com"), and the avatar circle shows the first letter of the email uppercased.
result: issue
reported: "si ma la mia mail che è loganwhitewolf@gmail.com non entra completamente nel riquadro che compare quando clicco sull'avatar. non si legge la m di .com finale della mia email"
severity: cosmetic

### 5. Logout
expected: While logged in, click the avatar → click "Logout". Expected: redirected to http://localhost:3000/login.
result: pass

### 6. Route protection — unauthenticated redirect
expected: Open an incognito/private window (or clear cookies). Navigate directly to http://localhost:3000/dashboard. Expected: redirected to http://localhost:3000/login.
result: pass

### 7. Auth error banner — wrong credentials
expected: On /login, enter a valid email with the wrong password. Click "Accedi". Expected: a red error banner appears inline with the text "Credenziali non valide. Riprova o contatta il supporto." No redirect.
result: pass

### 8. Register page Italian copy and layout
expected: On http://localhost:3000/register, verify: heading is "Crea account", CTA button reads "Registrati", there is a link "Hai già un account? Accedi" that leads to /login. All text is in Italian.
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Email address shown in full in avatar dropdown"
  status: failed
  reason: "User reported: loganwhitewolf@gmail.com non entra completamente nel riquadro — non si legge la m finale di .com"
  severity: cosmetic
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
