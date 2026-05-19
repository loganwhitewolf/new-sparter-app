# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transactions.spec.ts >> Transactions - TX-02: App shell navigation >> mobile bottom nav exposes a link to transactions
- Location: tests/transactions.spec.ts:80:7

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
        - navigation [ref=e7]:
          - button "previous" [disabled] [ref=e8]:
            - img "previous" [ref=e9]
          - generic [ref=e11]:
            - generic [ref=e12]: 1/
            - text: "1"
          - button "next" [disabled] [ref=e13]:
            - img "next" [ref=e14]
        - link "Next.js 16.2.4 (stale) Turbopack" [ref=e17] [cursor=pointer]:
          - /url: https://nextjs.org/docs/messages/version-staleness
          - img [ref=e18]
          - generic "There is a newer version (16.2.6) available, upgrade recommended!" [ref=e20]: Next.js 16.2.4 (stale)
          - generic [ref=e21]: Turbopack
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
            - generic [ref=e48]:
              - generic [ref=e49]: "Failed query: select \"transaction\".\"id\", \"transaction\".\"description\", \"transaction\".\"custom_title\", \"transaction\".\"amount\", \"transaction\".\"currency\", \"transaction\".\"occurred_at\", \"transaction\".\"row_index\", \"expense\".\"id\", \"expense\".\"title\", \"expense\".\"status\", \"file\".\"id\", coalesce(nullif(trim(coalesce(\"file\".\"display_name\", '')), ''), \"file\".\"original_name\"), \"file\".\"imported_at\", \"platform\".\"id\", \"platform\".\"name\", \"platform\".\"slug\" from \"transaction\" left join \"file\" on \"transaction\".\"file_id\" = \"file\".\"id\" left join \"import_format_version\" on \"file\".\"import_format_version_id\" = \"import_format_version\".\"id\" left join \"platform\" on \"import_format_version\".\"platform_id\" = \"platform\".\"id\" left join \"expense\" on \"transaction\".\"expense_id\" = \"expense\".\"id\" where (\"transaction\".\"user_id\" = $1 and (\"transaction\".\"file_id\" is null or \"file\".\"user_id\" = $2)) order by \"transaction\".\"occurred_at\" desc limit $3 params: staging-user,staging-user,50"
              - button "Show More" [ref=e51] [cursor=pointer]
          - generic [ref=e52]:
            - generic [ref=e53]:
              - paragraph [ref=e55]:
                - img [ref=e57]
                - generic [ref=e60]: app/(app)/transactions/page.tsx (22:49) @ TransactionsPage
                - button "Open in editor" [ref=e61] [cursor=pointer]:
                  - img [ref=e63]
              - generic [ref=e66]:
                - generic [ref=e67]: 20 | const params = await searchParams
                - generic [ref=e68]: 21 | const filters = parseTransactionFilters(params)
                - generic [ref=e69]: "> 22 | const [transactions, platforms, categories] = await Promise.all(["
                - generic [ref=e70]: "| ^"
                - generic [ref=e71]: 23 | getTransactions(filters),
                - generic [ref=e72]: 24 | getTransactionPlatforms(),
                - generic [ref=e73]: 25 | getCategories(),
            - generic [ref=e74]:
              - generic [ref=e75]:
                - paragraph [ref=e76]:
                  - text: Call Stack
                  - generic [ref=e77]: "6"
                - button "Show 5 ignore-listed frame(s)" [ref=e78] [cursor=pointer]:
                  - text: Show 5 ignore-listed frame(s)
                  - img [ref=e79]
              - generic [ref=e81]:
                - generic [ref=e82]:
                  - text: TransactionsPage
                  - button "Open TransactionsPage in editor" [ref=e83] [cursor=pointer]:
                    - img [ref=e84]
                - text: app/(app)/transactions/page.tsx (22:49)
            - generic [ref=e86]:
              - generic [ref=e88]: "Caused by: AggregateError"
              - paragraph [ref=e89]: An error occurred in the Server Components render but no message was provided
              - generic [ref=e90]:
                - paragraph [ref=e92]:
                  - img [ref=e94]
                  - generic [ref=e97]: app/(app)/transactions/page.tsx (22:49) @ TransactionsPage
                  - button "Open in editor" [ref=e98] [cursor=pointer]:
                    - img [ref=e100]
                - generic [ref=e103]:
                  - generic [ref=e104]: 20 | const params = await searchParams
                  - generic [ref=e105]: 21 | const filters = parseTransactionFilters(params)
                  - generic [ref=e106]: "> 22 | const [transactions, platforms, categories] = await Promise.all(["
                  - generic [ref=e107]: "| ^"
                  - generic [ref=e108]: 23 | getTransactions(filters),
                  - generic [ref=e109]: 24 | getTransactionPlatforms(),
                  - generic [ref=e110]: 25 | getCategories(),
              - generic [ref=e111]:
                - generic [ref=e112]:
                  - paragraph [ref=e113]:
                    - text: Call Stack
                    - generic [ref=e114]: "16"
                  - button "Show 14 ignore-listed frame(s)" [ref=e115] [cursor=pointer]:
                    - text: Show 14 ignore-listed frame(s)
                    - img [ref=e116]
                - generic [ref=e118]:
                  - generic [ref=e119]: Promise.all
                  - text: <anonymous>
                - generic [ref=e120]:
                  - generic [ref=e121]:
                    - text: TransactionsPage
                    - button "Open TransactionsPage in editor" [ref=e122] [cursor=pointer]:
                      - img [ref=e123]
                  - text: app/(app)/transactions/page.tsx (22:49)
        - generic [ref=e125]: "1"
        - generic [ref=e126]: "2"
    - generic [ref=e131] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e132]:
        - img [ref=e133]
      - generic [ref=e136]:
        - button "Open issues overlay" [ref=e137]:
          - generic [ref=e138]:
            - generic [ref=e139]: "0"
            - generic [ref=e140]: "1"
          - generic [ref=e141]: Issue
        - button "Collapse issues badge" [ref=e142]:
          - img [ref=e143]
  - generic [ref=e146]:
    - img [ref=e147]
    - heading "This page couldn’t load" [level=1] [ref=e149]
    - paragraph [ref=e150]: A server error occurred. Reload to try again.
    - button "Reload" [ref=e153] [cursor=pointer]
  - paragraph [ref=e154]: ERROR 1425008386
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
> 89  |     await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
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