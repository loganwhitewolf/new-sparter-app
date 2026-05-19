# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transactions.spec.ts >> Transactions - TX-02: App shell navigation >> desktop sidebar exposes a link to transactions
- Location: tests/transactions.spec.ts:69:7

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
              - text: "1"
            - button "next" [disabled] [ref=e13]:
              - img "next" [ref=e14]
          - img
        - generic [ref=e16]:
          - link "Next.js 16.2.4 (stale) Turbopack" [ref=e17] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
            - img [ref=e18]
            - generic "There is a newer version (16.2.6) available, upgrade recommended!" [ref=e20]: Next.js 16.2.4 (stale)
            - generic [ref=e21]: Turbopack
          - img
      - dialog "Runtime Error" [ref=e23]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]:
              - generic [ref=e29]:
                - generic [ref=e30]: Runtime Error
                - generic [ref=e31]: Server
              - generic [ref=e32]:
                - button "Copy Error Info" [ref=e33] [cursor=pointer]:
                  - img [ref=e34]
                - button "No related documentation found" [disabled] [ref=e36]:
                  - img [ref=e37]
                - button "Attach Node.js inspector" [ref=e39] [cursor=pointer]:
                  - img [ref=e40]
            - generic [ref=e49]: "Failed query: select distinct \"platform\".\"id\", \"platform\".\"name\", \"platform\".\"slug\" from \"transaction\" left join \"file\" on \"transaction\".\"file_id\" = \"file\".\"id\" left join \"import_format_version\" on \"file\".\"import_format_version_id\" = \"import_format_version\".\"id\" inner join \"platform\" on \"import_format_version\".\"platform_id\" = \"platform\".\"id\" where (\"transaction\".\"user_id\" = $1 and \"file\".\"user_id\" = $2) order by \"platform\".\"name\" asc params: staging-user,staging-user"
          - generic [ref=e50]:
            - generic [ref=e51]:
              - paragraph [ref=e53]:
                - img [ref=e55]
                - generic [ref=e58]: app/(app)/transactions/page.tsx (22:49) @ TransactionsPage
                - button "Open in editor" [ref=e59] [cursor=pointer]:
                  - img [ref=e61]
              - generic [ref=e64]:
                - generic [ref=e65]: 20 | const params = await searchParams
                - generic [ref=e66]: 21 | const filters = parseTransactionFilters(params)
                - generic [ref=e67]: "> 22 | const [transactions, platforms, categories] = await Promise.all(["
                - generic [ref=e68]: "| ^"
                - generic [ref=e69]: 23 | getTransactions(filters),
                - generic [ref=e70]: 24 | getTransactionPlatforms(),
                - generic [ref=e71]: 25 | getCategories(),
            - generic [ref=e72]:
              - generic [ref=e73]:
                - paragraph [ref=e74]:
                  - text: Call Stack
                  - generic [ref=e75]: "6"
                - button "Show 5 ignore-listed frame(s)" [ref=e76] [cursor=pointer]:
                  - text: Show 5 ignore-listed frame(s)
                  - img [ref=e77]
              - generic [ref=e79]:
                - generic [ref=e80]:
                  - text: TransactionsPage
                  - button "Open TransactionsPage in editor" [ref=e81] [cursor=pointer]:
                    - img [ref=e82]
                - text: app/(app)/transactions/page.tsx (22:49)
            - generic [ref=e84]:
              - generic [ref=e86]: "Caused by: AggregateError"
              - paragraph [ref=e87]: An error occurred in the Server Components render but no message was provided
              - generic [ref=e88]:
                - paragraph [ref=e90]:
                  - img [ref=e92]
                  - generic [ref=e95]: app/(app)/transactions/page.tsx (22:49) @ TransactionsPage
                  - button "Open in editor" [ref=e96] [cursor=pointer]:
                    - img [ref=e98]
                - generic [ref=e101]:
                  - generic [ref=e102]: 20 | const params = await searchParams
                  - generic [ref=e103]: 21 | const filters = parseTransactionFilters(params)
                  - generic [ref=e104]: "> 22 | const [transactions, platforms, categories] = await Promise.all(["
                  - generic [ref=e105]: "| ^"
                  - generic [ref=e106]: 23 | getTransactions(filters),
                  - generic [ref=e107]: 24 | getTransactionPlatforms(),
                  - generic [ref=e108]: 25 | getCategories(),
              - generic [ref=e109]:
                - generic [ref=e110]:
                  - paragraph [ref=e111]:
                    - text: Call Stack
                    - generic [ref=e112]: "16"
                  - button "Show 14 ignore-listed frame(s)" [ref=e113] [cursor=pointer]:
                    - text: Show 14 ignore-listed frame(s)
                    - img [ref=e114]
                - generic [ref=e116]:
                  - generic [ref=e117]: Promise.all
                  - text: <anonymous>
                - generic [ref=e118]:
                  - generic [ref=e119]:
                    - text: TransactionsPage
                    - button "Open TransactionsPage in editor" [ref=e120] [cursor=pointer]:
                      - img [ref=e121]
                  - text: app/(app)/transactions/page.tsx (22:49)
        - generic [ref=e123]: "1"
        - generic [ref=e124]: "2"
    - generic [ref=e129] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e130]:
        - img [ref=e131]
      - generic [ref=e134]:
        - button "Open issues overlay" [ref=e135]:
          - generic [ref=e136]:
            - generic [ref=e137]: "0"
            - generic [ref=e138]: "1"
          - generic [ref=e139]: Issue
        - button "Collapse issues badge" [ref=e140]:
          - img [ref=e141]
  - generic [ref=e144]:
    - img [ref=e145]
    - heading "This page couldn’t load" [level=1] [ref=e147]
    - paragraph [ref=e148]: A server error occurred. Reload to try again.
    - button "Reload" [ref=e151] [cursor=pointer]
  - paragraph [ref=e152]: ERROR 1117718467
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
  21  |   await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
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
> 77  |     await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
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