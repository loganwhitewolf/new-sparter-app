import { expect, test } from '@playwright/test'

test.describe('Auth - AUTH-01: Registration', () => {
  test('register happy path: valid email+password redirects to /dashboard', async ({ page }) => {
    test.fixme()
    // AUTH-01: POST /register with valid email+password → 200 redirect → /dashboard
    // Implement when Plan 03 (server actions) is complete
  })

  test('register invalid email: shows error banner', async ({ page }) => {
    test.fixme()
    // AUTH-01: POST /register with malformed email → validation error banner shown
    // Zod schema rejects non-email string; no DB write occurs
    // Implement when Plan 01 (UI) + Plan 03 (server actions) are complete
  })

  test('register short password (< 8 chars): shows error banner', async ({ page }) => {
    test.fixme()
    // AUTH-01: POST /register with password shorter than 8 characters → Zod error
    // Error banner shown; no DB write; password not echoed back
    // Implement when Plan 01 (UI) + Plan 03 (server actions) are complete
  })

  test('register duplicate email: shows generic error (no enumeration)', async ({ page }) => {
    test.fixme()
    // AUTH-01: POST /register with already-registered email → generic error banner
    // Error message must NOT reveal that the email exists (no enumeration)
    // Implement when Plan 03 (server actions) is complete
  })
})

test.describe('Auth - AUTH-02: Login and session', () => {
  test('login happy path: valid credentials redirects to /dashboard', async ({ page }) => {
    test.fixme()
    // AUTH-02: POST /login with correct email+password → session cookie set → redirect /dashboard
    // Cookie must be HttpOnly; JS cannot read it
    // Implement when Plan 02 (UI) + Plan 03 (server actions) are complete
  })

  test('login session persistence: stays authenticated after page reload', async ({ page }) => {
    test.fixme()
    // AUTH-02: After login, reload /dashboard → still authenticated (session cookie valid)
    // Implement when Plan 02 (UI) + Plan 03 (server actions) are complete
  })

  test('login wrong credentials: shows generic error banner', async ({ page }) => {
    test.fixme()
    // AUTH-02: POST /login with wrong password or unknown email → generic error banner
    // Error message must NOT reveal which field is wrong (no credential enumeration)
    // Implement when Plan 02 (UI) + Plan 03 (server actions) are complete
  })
})

test.describe('Auth - AUTH-03: Route protection', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    const response = await page.goto('/dashboard')
    // After proxy.ts wired (Plan 04): expects redirect to /login
    // Before Plan 04: proxy.ts passes all requests, page returns 200 — this test intentionally fails
    expect(response?.url()).toContain('/login')
  })

  test('x-staging-key header bypasses auth on /dashboard', async ({ page }) => {
    test.fixme()
    // AUTH-03: Set header 'x-staging-key: <STAGING_KEY env var>' → /dashboard returns 200
    // Implement using page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? '' })
    // STAGING_KEY must NOT be set in production environment
  })
})
