---
status: partial
phase: 31-oauth-ui
source: [31-VERIFICATION.md]
started: 2026-05-21T16:38:00.000Z
updated: 2026-05-21T16:38:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Provider button visibility (OAUTH-05)
expected: Visiting /login with GOOGLE_CLIENT_ID and GITHUB_CLIENT_ID set in env renders both "Continua con Google" and "Continua con GitHub" buttons above the email/password form, with Google first and "Oppure" divider visible. Unsetting both vars renders only the email/password form with no social section.
result: [pending]

### 2. OAuth error display (OAUTH-01 error path)
expected: Visiting /login?error=OAuthCallbackError renders a destructive Alert above the form with the Italian message "Accesso con social non riuscito. Riprova." (or equivalent generic fallback from getOAuthErrorMessage).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
