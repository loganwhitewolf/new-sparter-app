# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile.spec.ts >> Profile - PROF-04: topbar navigation >> PROF-04 topbar profile dropdown navigates to /profile
- Location: tests/profile.spec.ts:87:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Profilo' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Profilo' })

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
            - generic [ref=e49]: "Failed query: select \"first_name\", \"last_name\", \"job_title\", \"location\", \"phone\", \"timezone\", \"passion\", \"email\", \"subscriptionPlan\", \"role\", \"updated_at\" from \"user\" where \"user\".\"id\" = $1 limit $2 params: staging-user,1"
          - generic [ref=e50]:
            - generic [ref=e51]:
              - paragraph [ref=e53]:
                - img [ref=e55]
                - generic [ref=e59]: lib/dal/users.ts (38:16) @ getUserProfile
                - button "Open in editor" [ref=e60] [cursor=pointer]:
                  - img [ref=e62]
              - generic [ref=e65]:
                - generic [ref=e66]: 36 |
                - generic [ref=e67]: "37 | export async function getUserProfile(userId: string): Promise<UserProfile> {"
                - generic [ref=e68]: "> 38 | const rows = await db"
                - generic [ref=e69]: "| ^"
                - generic [ref=e70]: "39 | .select({"
                - generic [ref=e71]: "40 | firstName: user.firstName,"
                - generic [ref=e72]: "41 | lastName: user.lastName,"
            - generic [ref=e73]:
              - generic [ref=e74]:
                - paragraph [ref=e75]:
                  - text: Call Stack
                  - generic [ref=e76]: "7"
                - button "Show 5 ignore-listed frame(s)" [ref=e77] [cursor=pointer]:
                  - text: Show 5 ignore-listed frame(s)
                  - img [ref=e78]
              - generic [ref=e80]:
                - generic [ref=e81]:
                  - text: getUserProfile
                  - button "Open getUserProfile in editor" [ref=e82] [cursor=pointer]:
                    - img [ref=e83]
                - text: lib/dal/users.ts (38:16)
              - generic [ref=e85]:
                - generic [ref=e86]:
                  - text: ProfilePage
                  - button "Open ProfilePage in editor" [ref=e87] [cursor=pointer]:
                    - img [ref=e88]
                - text: app/(app)/profile/page.tsx (12:19)
            - generic [ref=e90]:
              - generic [ref=e92]: "Caused by: AggregateError"
              - paragraph [ref=e93]: An error occurred in the Server Components render but no message was provided
              - generic [ref=e94]:
                - paragraph [ref=e96]:
                  - img [ref=e98]
                  - generic [ref=e102]: lib/dal/users.ts (38:16) @ getUserProfile
                  - button "Open in editor" [ref=e103] [cursor=pointer]:
                    - img [ref=e105]
                - generic [ref=e108]:
                  - generic [ref=e109]: 36 |
                  - generic [ref=e110]: "37 | export async function getUserProfile(userId: string): Promise<UserProfile> {"
                  - generic [ref=e111]: "> 38 | const rows = await db"
                  - generic [ref=e112]: "| ^"
                  - generic [ref=e113]: "39 | .select({"
                  - generic [ref=e114]: "40 | firstName: user.firstName,"
                  - generic [ref=e115]: "41 | lastName: user.lastName,"
              - generic [ref=e116]:
                - generic [ref=e117]:
                  - paragraph [ref=e118]:
                    - text: Call Stack
                    - generic [ref=e119]: "16"
                  - button "Show 14 ignore-listed frame(s)" [ref=e120] [cursor=pointer]:
                    - text: Show 14 ignore-listed frame(s)
                    - img [ref=e121]
                - generic [ref=e123]:
                  - generic [ref=e124]:
                    - text: getUserProfile
                    - button "Open getUserProfile in editor" [ref=e125] [cursor=pointer]:
                      - img [ref=e126]
                  - text: lib/dal/users.ts (38:16)
                - generic [ref=e128]:
                  - generic [ref=e129]:
                    - text: ProfilePage
                    - button "Open ProfilePage in editor" [ref=e130] [cursor=pointer]:
                      - img [ref=e131]
                  - text: app/(app)/profile/page.tsx (12:19)
        - generic [ref=e133]: "1"
        - generic [ref=e134]: "2"
    - generic [ref=e139] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e140]:
        - img [ref=e141]
      - generic [ref=e144]:
        - button "Open issues overlay" [ref=e145]:
          - generic [ref=e146]:
            - generic [ref=e147]: "0"
            - generic [ref=e148]: "1"
          - generic [ref=e149]: Issue
        - button "Collapse issues badge" [ref=e150]:
          - img [ref=e151]
  - generic [ref=e153]: "0"
  - generic [ref=e155]:
    - img [ref=e156]
    - heading "This page couldn’t load" [level=1] [ref=e158]
    - paragraph [ref=e159]: A server error occurred. Reload to try again.
    - button "Reload" [ref=e162] [cursor=pointer]
  - paragraph [ref=e163]: ERROR 3215591637
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test'
  2   | 
  3   | async function openProfile(page: Page) {
  4   |   await page.setExtraHTTPHeaders({
  5   |     'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  6   |   })
  7   |   await page.goto('/profile')
  8   | }
  9   | 
  10  | test.describe('Profile - PROF-01: page shell', () => {
  11  |   test('PROF-01 /profile returns 200', async ({ page }) => {
  12  |     await page.setExtraHTTPHeaders({
  13  |       'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  14  |     })
  15  |     const response = await page.goto('/profile')
  16  |     expect(response?.status()).toBe(200)
  17  |   })
  18  | 
  19  |   test('PROF-01 profile page renders heading', async ({ page }) => {
  20  |     await openProfile(page)
  21  |     await expect(page.getByRole('heading', { name: 'Profilo' })).toBeVisible()
  22  |   })
  23  | })
  24  | 
  25  | test.describe('Profile - PROF-02: editable form fields', () => {
  26  |   test('PROF-02 six labeled editable inputs are present', async ({ page }) => {
  27  |     await openProfile(page)
  28  | 
  29  |     await expect(page.getByLabel('Nome', { exact: true })).toBeVisible()
  30  |     await expect(page.getByLabel('Cognome', { exact: true })).toBeVisible()
  31  |     await expect(page.getByLabel('Ruolo professionale')).toBeVisible()
  32  |     await expect(page.getByLabel('Località')).toBeVisible()
  33  |     await expect(page.getByLabel('Telefono')).toBeVisible()
  34  |     await expect(page.getByLabel('Fuso orario')).toBeVisible()
  35  |   })
  36  | 
  37  |   test('PROF-02 editable fields are actual form inputs', async ({ page }) => {
  38  |     await openProfile(page)
  39  | 
  40  |     const inputs = ['firstName', 'lastName', 'jobTitle', 'location', 'phone', 'timezone']
  41  |     for (const name of inputs) {
  42  |       await expect(page.locator(`input[name="${name}"]`)).toBeVisible()
  43  |     }
  44  |   })
  45  | 
  46  |   test('PROF-02 empty fields render without uncontrolled/controlled React warnings', async ({ page }) => {
  47  |     const consoleErrors: string[] = []
  48  |     page.on('console', (msg) => {
  49  |       if (msg.type() === 'error' || (msg.type() === 'warning' && msg.text().includes('controlled'))) {
  50  |         consoleErrors.push(msg.text())
  51  |       }
  52  |     })
  53  |     await openProfile(page)
  54  |     const controlledWarnings = consoleErrors.filter((e) =>
  55  |       e.toLowerCase().includes('controlled') || e.toLowerCase().includes('uncontrolled'),
  56  |     )
  57  |     expect(controlledWarnings).toHaveLength(0)
  58  |   })
  59  | })
  60  | 
  61  | test.describe('Profile - PROF-03: read-only account fields', () => {
  62  |   test('PROF-03 email is visible but not an editable input', async ({ page }) => {
  63  |     await openProfile(page)
  64  | 
  65  |     // Email should be visible on page
  66  |     await expect(page.locator('#account-email')).toBeVisible()
  67  |     // There must be no <input name="email"> in the form
  68  |     await expect(page.locator('input[name="email"]')).toHaveCount(0)
  69  |   })
  70  | 
  71  |   test('PROF-03 subscription plan is visible but not an editable input', async ({ page }) => {
  72  |     await openProfile(page)
  73  | 
  74  |     await expect(page.locator('#account-plan')).toBeVisible()
  75  |     await expect(page.locator('input[name="subscriptionPlan"]')).toHaveCount(0)
  76  |   })
  77  | 
  78  |   test('PROF-03 role is visible but not an editable input', async ({ page }) => {
  79  |     await openProfile(page)
  80  | 
  81  |     await expect(page.locator('#account-role')).toBeVisible()
  82  |     await expect(page.locator('input[name="role"]')).toHaveCount(0)
  83  |   })
  84  | })
  85  | 
  86  | test.describe('Profile - PROF-04: topbar navigation', () => {
  87  |   test('PROF-04 topbar profile dropdown navigates to /profile', async ({ page }) => {
  88  |     await page.setExtraHTTPHeaders({
  89  |       'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  90  |     })
  91  |     await page.goto('/dashboard')
  92  | 
  93  |     // Open the avatar dropdown
  94  |     await page.getByRole('button', { name: 'Menu utente' }).click()
  95  | 
  96  |     // Click the Profilo menu item — it is a link inside DropdownMenuItem asChild
  97  |     await page.getByRole('menuitem', { name: 'Profilo' }).click()
  98  | 
  99  |     await expect(page).toHaveURL(/\/profile/)
> 100 |     await expect(page.getByRole('heading', { name: 'Profilo' })).toBeVisible()
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  101 |   })
  102 | })
  103 | 
  104 | test.describe('Profile - PROF-05: form accessibility', () => {
  105 |   test('PROF-05 save button is present and keyboard-submittable', async ({ page }) => {
  106 |     await openProfile(page)
  107 | 
  108 |     const saveBtn = page.getByRole('button', { name: 'Salva modifiche' })
  109 |     await expect(saveBtn).toBeVisible()
  110 |     await expect(saveBtn).toBeEnabled()
  111 |   })
  112 | })
  113 | 
  114 | test.describe('Profile - PROF-06: unauthenticated redirect', () => {
  115 |   test('PROF-06 /profile without staging key redirects to login', async ({ page }) => {
  116 |     await page.goto('/profile')
  117 |     await expect(page).toHaveURL(/\/login/)
  118 |   })
  119 | })
  120 | 
```