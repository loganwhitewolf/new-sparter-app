# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transactions.spec.ts >> Transactions - TX-01: Route smoke >> renders the transactions route with filters and empty-or-table state
- Location: tests/transactions.spec.ts:47:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Transazioni' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Transazioni' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [active]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - navigation [ref=e7]:
            - button "previous" [disabled] [ref=e8]:
              - img "previous" [ref=e9]
            - generic [ref=e11]:
              - generic [ref=e12]: 1/
              - text: "2"
            - button "next" [ref=e13] [cursor=pointer]:
              - img "next" [ref=e14]
          - img
        - generic [ref=e16]:
          - link "Next.js 16.2.4 (stale) Turbopack" [ref=e17] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
            - img [ref=e18]
            - generic "There is a newer version (16.2.6) available, upgrade recommended!" [ref=e20]: Next.js 16.2.4 (stale)
            - generic [ref=e21]: Turbopack
          - img
      - generic [ref=e22]:
        - dialog "Console Error" [ref=e23]:
          - generic [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e28]:
                - generic [ref=e30]: Console Error
                - generic [ref=e31]:
                  - button "Copy Error Info" [ref=e32] [cursor=pointer]:
                    - img [ref=e33]
                  - button "No related documentation found" [disabled] [ref=e35]:
                    - img [ref=e36]
                  - button "Attach Node.js inspector" [ref=e38] [cursor=pointer]:
                    - img [ref=e39]
              - generic [ref=e48]:
                - text: Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead (
                - link "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template" [ref=e49] [cursor=pointer]:
                  - /url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template
                - text: ).
            - generic [ref=e50]:
              - generic [ref=e51]:
                - paragraph [ref=e53]:
                  - img [ref=e55]
                  - generic [ref=e58]: components/theme-provider.tsx (7:10) @ ThemeProvider
                  - button "Open in editor" [ref=e59] [cursor=pointer]:
                    - img [ref=e61]
                - generic [ref=e64]:
                  - generic [ref=e65]: 5 |
                  - generic [ref=e66]: "6 | export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {"
                  - generic [ref=e67]: "> 7 | return <NextThemesProvider {...props}>{children}</NextThemesProvider>"
                  - generic [ref=e68]: "| ^"
                  - generic [ref=e69]: "8 | }"
                  - generic [ref=e70]: 9 |
              - generic [ref=e71]:
                - generic [ref=e72]:
                  - paragraph [ref=e73]:
                    - text: Call Stack
                    - generic [ref=e74]: "18"
                  - button "Show 15 ignore-listed frame(s)" [ref=e75] [cursor=pointer]:
                    - text: Show 15 ignore-listed frame(s)
                    - img [ref=e76]
                - generic [ref=e78]:
                  - generic [ref=e79]: script
                  - text: <anonymous>
                - generic [ref=e80]:
                  - generic [ref=e81]:
                    - text: ThemeProvider
                    - button "Open ThemeProvider in editor" [ref=e82] [cursor=pointer]:
                      - img [ref=e83]
                  - text: components/theme-provider.tsx (7:10)
                - generic [ref=e85]:
                  - generic [ref=e86]:
                    - text: RootLayout
                    - button "Open RootLayout in editor" [ref=e87] [cursor=pointer]:
                      - img [ref=e88]
                  - text: app/layout.tsx (20:9)
          - generic [ref=e90]: "1"
          - generic [ref=e91]: "2"
        - contentinfo [ref=e92]:
          - region "Error feedback" [ref=e93]:
            - paragraph [ref=e94]:
              - link "Was this helpful?" [ref=e95] [cursor=pointer]:
                - /url: https://nextjs.org/telemetry#error-feedback
            - button "Mark as helpful" [ref=e96] [cursor=pointer]:
              - img [ref=e97]
            - button "Mark as not helpful" [ref=e100] [cursor=pointer]:
              - img [ref=e101]
    - generic [ref=e107] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e108]:
        - img [ref=e109]
      - generic [ref=e112]:
        - button "Open issues overlay" [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e115]: "1"
            - generic [ref=e116]: "2"
          - generic [ref=e117]:
            - text: Issue
            - generic [ref=e118]: s
        - button "Collapse issues badge" [ref=e119]:
          - img [ref=e120]
  - generic [ref=e123]:
    - img [ref=e124]
    - heading "This page couldn’t load" [level=1] [ref=e126]
    - paragraph [ref=e127]: A server error occurred. Reload to try again.
    - button "Reload" [ref=e130] [cursor=pointer]
  - paragraph [ref=e131]: ERROR 1425008386
```

# Test source

```ts
  1   | // Transaction E2E tests
  2   | // Data-dependent acceptance checks are marked fixme — run against staging with seeded DB.
  3   | // Runnable smoke checks verify route rendering, safe query handling, and app-shell discoverability.
  4   | // Run: npx playwright test tests/transactions.spec.ts
  5   | 
  6   | import { expect, test, type Page } from '@playwright/test'
  7   | 
  8   | const hasStagingBypass = Boolean(process.env.STAGING_KEY)
  9   | 
  10  | async function openTransactions(page: Page, path = '/transactions') {
  11  |   if (process.env.STAGING_KEY) {
  12  |     await page.setExtraHTTPHeaders({
  13  |       'x-staging-key': process.env.STAGING_KEY,
  14  |     })
  15  |   }
  16  | 
  17  |   await page.goto(path)
  18  | }
  19  | 
  20  | async function expectTransactionsShell(page: Page) {
> 21  |   await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  22  | 
  23  |   const emptyState = page.getByText('Nessuna transazione trovata')
  24  |   const transactionTable = page.getByRole('table', {
  25  |     name: /Elenco transazioni importate/i,
  26  |   })
  27  | 
  28  |   await expect(emptyState.or(transactionTable).first()).toBeVisible()
  29  |   await expect(page.getByLabel('Data da')).toBeVisible()
  30  |   await expect(page.getByLabel('Data a')).toBeVisible()
  31  |   await expect(page.getByRole('combobox', { name: 'Piattaforma' })).toBeVisible()
  32  |   await expect(
  33  |     page.getByRole('combobox', { name: 'Ordina transazioni' }),
  34  |   ).toBeVisible()
  35  | }
  36  | 
  37  | test.describe('Transactions - TX-01: Route smoke', () => {
  38  |   test('unauthenticated transactions route redirects to login when no staging bypass is configured', async ({ page }) => {
  39  |     test.skip(hasStagingBypass, 'Authenticated route smoke covers this when STAGING_KEY is configured')
  40  | 
  41  |     const response = await page.goto('/transactions')
  42  | 
  43  |     expect(response?.url()).toContain('/login')
  44  |     await expect(page.getByRole('heading', { name: /accedi/i })).toBeVisible()
  45  |   })
  46  | 
  47  |   test('renders the transactions route with filters and empty-or-table state', async ({ page }) => {
  48  |     test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass or PLAYWRIGHT_BASE_URL pointing to an authenticated staging session')
  49  | 
  50  |     await openTransactions(page)
  51  | 
  52  |     await expectTransactionsShell(page)
  53  |   })
  54  | 
  55  |   test('invalid query params render safe defaults instead of a server error', async ({ page }) => {
  56  |     test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass or PLAYWRIGHT_BASE_URL pointing to an authenticated staging session')
  57  | 
  58  |     await openTransactions(page, '/transactions?sort=rawRow&dir=sideways&from=bad')
  59  | 
  60  |     await expectTransactionsShell(page)
  61  |     await expect(page.getByLabel('Data da')).toHaveValue('')
  62  |     await expect(
  63  |       page.getByRole('button', { name: 'Imposta ordinamento crescente' }),
  64  |     ).toBeVisible()
  65  |   })
  66  | })
  67  | 
  68  | test.describe('Transactions - TX-02: App shell navigation', () => {
  69  |   test('desktop sidebar exposes a link to transactions', async ({ page }) => {
  70  |     test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass to reach the protected app shell')
  71  | 
  72  |     await openTransactions(page, '/dashboard')
  73  | 
  74  |     await page.getByRole('link', { name: 'Transazioni' }).click()
  75  | 
  76  |     await expect(page).toHaveURL(/\/transactions$/)
  77  |     await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
  78  |   })
  79  | 
  80  |   test('mobile bottom nav exposes a link to transactions', async ({ page }) => {
  81  |     test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass to reach the protected app shell')
  82  | 
  83  |     await page.setViewportSize({ width: 375, height: 812 })
  84  |     await openTransactions(page, '/dashboard')
  85  | 
  86  |     await page.getByRole('link', { name: 'Transazioni' }).click()
  87  | 
  88  |     await expect(page).toHaveURL(/\/transactions$/)
  89  |     await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
  90  |   })
  91  | })
  92  | 
  93  | test.describe('Transactions - TX-03: Filter acceptance', () => {
  94  |   test('date, platform, and sort controls persist in the URL and refresh rows', async ({ page }) => {
  95  |     test.fixme(
  96  |       true,
  97  |       'Requires seeded imported transactions and at least one platform — run with PLAYWRIGHT_BASE_URL pointing to staging. Acceptance flow: navigate /transactions, apply Data da/Data a and Piattaforma filters, change Ordina transazioni, verify URL params change and visible rows update.',
  98  |     )
  99  | 
  100 |     await openTransactions(page)
  101 |     await page.getByLabel('Data da').fill('2024-01-01')
  102 |     await expect(page).toHaveURL(/from=2024-01-01/)
  103 |     await page.getByRole('combobox', { name: 'Piattaforma' }).click()
  104 |     await page.getByRole('option').nth(1).click()
  105 |     await expect(page).toHaveURL(/platform=/)
  106 |     await page.getByRole('combobox', { name: 'Ordina transazioni' }).click()
  107 |     await page.getByRole('option', { name: 'Importo' }).click()
  108 |     await expect(page).toHaveURL(/sort=amount/)
  109 |   })
  110 | })
  111 | 
```