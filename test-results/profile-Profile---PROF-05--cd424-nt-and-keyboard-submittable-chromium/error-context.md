# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile.spec.ts >> Profile - PROF-05: form accessibility >> PROF-05 save button is present and keyboard-submittable
- Location: tests/profile.spec.ts:105:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Salva modifiche' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Salva modifiche' })

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
  - paragraph [ref=e131]: ERROR 3215591637
```

# Test source

```ts
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
  100 |     await expect(page.getByRole('heading', { name: 'Profilo' })).toBeVisible()
  101 |   })
  102 | })
  103 | 
  104 | test.describe('Profile - PROF-05: form accessibility', () => {
  105 |   test('PROF-05 save button is present and keyboard-submittable', async ({ page }) => {
  106 |     await openProfile(page)
  107 | 
  108 |     const saveBtn = page.getByRole('button', { name: 'Salva modifiche' })
> 109 |     await expect(saveBtn).toBeVisible()
      |                           ^ Error: expect(locator).toBeVisible() failed
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