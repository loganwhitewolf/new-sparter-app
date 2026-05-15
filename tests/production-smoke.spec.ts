import { expect, test, type Page, type APIRequestContext } from '@playwright/test'

const SIGNUP_PATH = '/api/auth/sign-up/email'
const AUTHENTICATED_CHECKPOINT = /\/dashboard(?:[/?#]|$)/
const ANALYZE_CHECKPOINT = /\/import\/[^/]+\/analyze(?:[/?#]|$)/

const REQUIRED_BASE_ENV = [
  'PLAYWRIGHT_PRODUCTION_SMOKE',
  'PLAYWRIGHT_BASE_URL',
  'PLAYWRIGHT_SMOKE_EMAIL',
  'PLAYWRIGHT_SMOKE_PASSWORD',
] as const

const FORBIDDEN_DIAGNOSTIC_PATTERNS = [
  /https?:\/\/[^\s"']+/i,
  /X-Amz-/i,
  /Signature=/i,
  /Credential=/i,
  /presigned/i,
  /objectKey/i,
  /cookie/i,
  /authorization/i,
  /password/i,
  /date,description,amount/i,
  /Smoke browser import/i,
  /(?:Error|TypeError|SyntaxError|UploadPutError):[\s\S]*\bat\s+/i,
]

function envFlag(name: string) {
  return process.env[name] === '1' || process.env[name] === 'true'
}

function missingBaseEnv() {
  const missing = REQUIRED_BASE_ENV.filter((name) => {
    if (name === 'PLAYWRIGHT_PRODUCTION_SMOKE') return !envFlag(name)
    return !process.env[name]
  })
  return missing
}

function disposableCredentials() {
  return {
    email: process.env.PLAYWRIGHT_SMOKE_EMAIL ?? '',
    password: process.env.PLAYWRIGHT_SMOKE_PASSWORD ?? '',
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: /^accedi$/i }).click()
  await page.waitForURL(AUTHENTICATED_CHECKPOINT)
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
}

async function register(page: Page, email: string, password: string) {
  await page.goto('/register')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: /^registrati$/i }).click()
  await page.waitForURL(AUTHENTICATED_CHECKPOINT)
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
}

async function expectDisabledSignup(request: APIRequestContext) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const response = await request.post(SIGNUP_PATH, {
    data: {
      name: 'Production Smoke',
      email: `production-smoke-disabled-${nonce}@example.invalid`,
      password: `Smoke-${nonce}-Password!`,
    },
  })
  expect(response.status()).toBe(403)

  const body = await response.json().catch(() => null) as { error?: { code?: string } } | null
  expect(body?.error?.code).toBe('registration_disabled')
}

async function installSafeDiagnosticCollector(page: Page) {
  await page.addInitScript(() => {
    const append = (kind: string, payload: unknown) => {
      const current = (window as Window & { __productionSmokeDiagnostics?: unknown[] }).__productionSmokeDiagnostics ?? []
      ;(window as unknown as Window & { __productionSmokeDiagnostics: unknown[] }).__productionSmokeDiagnostics = [
        ...current,
        { kind, payload },
      ].slice(-50)
    }

    window.addEventListener('upload-put-diagnostic', (event) => {
      append('upload-put-diagnostic', event instanceof CustomEvent ? event.detail : null)
    })
  })

  page.on('console', (message) => {
    const text = message.text()
    ;(page as Page & { __productionSmokeConsole?: string[] }).__productionSmokeConsole = [
      ...((page as Page & { __productionSmokeConsole?: string[] }).__productionSmokeConsole ?? []),
      `${message.type()}:${text}`,
    ].slice(-50)
  })
}

async function assertNoForbiddenDiagnostics(page: Page) {
  const diagnostics = await page.evaluate(() => (
    (window as Window & { __productionSmokeDiagnostics?: unknown[] }).__productionSmokeDiagnostics ?? []
  ))
  const consoleMessages = (page as Page & { __productionSmokeConsole?: string[] }).__productionSmokeConsole ?? []
  const serialized = JSON.stringify({ diagnostics, consoleMessages })

  for (const pattern of FORBIDDEN_DIAGNOSTIC_PATTERNS) {
    expect(serialized, `production smoke diagnostics must not match ${pattern}`).not.toMatch(pattern)
  }
}

function tinyCsvFixture() {
  return Buffer.from('date,description,amount\n2026-01-01,Smoke browser import,1.23\n')
}

test.describe('optional production browser smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async () => {
    const missing = missingBaseEnv()
    test.skip(
      missing.length > 0,
      `Set ${missing.join(', ')} to run the optional production browser smoke. Default runs skip safely without contacting production.`,
    )
  })

  test('enabled registration creates a disposable user and reaches dashboard', async ({ page }) => {
    test.skip(envFlag('PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED'), 'Registration-disabled phase requested; enabled signup smoke intentionally skipped.')

    const { email, password } = disposableCredentials()

    await test.step('register disposable account through deployed UI', async () => {
      await register(page, email, password)
    })

    await test.step('login preserves authenticated dashboard checkpoint', async () => {
      await page.context().clearCookies()
      await login(page, email, password)
    })
  })

  test('disabled registration rejects direct signup while existing login still works', async ({ page, request }) => {
    test.skip(!envFlag('PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED'), 'Set PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED=1 after redeploying with REGISTRATION_ENABLED=false.')

    const { email, password } = disposableCredentials()

    await test.step('direct signup returns sanitized disabled-registration code', async () => {
      await expectDisabledSignup(request)
    })

    await test.step('existing user can still login to dashboard', async () => {
      await login(page, email, password)
    })
  })

  test('optional R2 browser import reaches analyze route without unsafe diagnostics', async ({ page }) => {
    test.skip(!envFlag('PLAYWRIGHT_SMOKE_RUN_IMPORT'), 'Set PLAYWRIGHT_SMOKE_RUN_IMPORT=1 to exercise the deployed R2 browser import flow.')

    const { email, password } = disposableCredentials()
    await installSafeDiagnosticCollector(page)

    await test.step('login and open import dialog', async () => {
      await login(page, email, password)
      await page.goto('/import')
      await page.getByRole('button', { name: /^importa file$/i }).click()
      await expect(page.getByRole('dialog', { name: /importa file bancario/i })).toBeVisible()
    })

    await test.step('upload tiny generated CSV and wait for analysis checkpoint', async () => {
      await page.locator('#import-file-input').setInputFiles({
        name: 'production-smoke.csv',
        mimeType: 'text/csv',
        buffer: tinyCsvFixture(),
      })
      await page.getByRole('button', { name: /carica file/i }).click()
      await page.waitForURL(ANALYZE_CHECKPOINT, { timeout: 30_000 })
      await expect(page.getByRole('heading', { name: /analisi file/i })).toBeVisible()
    })

    await test.step('assert browser diagnostics remain sanitized', async () => {
      await assertNoForbiddenDiagnostics(page)
    })
  })
})
