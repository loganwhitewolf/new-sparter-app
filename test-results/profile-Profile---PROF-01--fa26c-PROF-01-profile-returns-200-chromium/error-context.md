# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile.spec.ts >> Profile - PROF-01: page shell >> PROF-01 /profile returns 200
- Location: tests/profile.spec.ts:11:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 500
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - generic [ref=e12]:
    - img [ref=e13]
    - heading "This page couldn’t load" [level=1] [ref=e15]
    - paragraph [ref=e16]: A server error occurred. Reload to try again.
    - button "Reload" [ref=e19] [cursor=pointer]
  - paragraph [ref=e20]: ERROR 3215591637
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
> 16  |     expect(response?.status()).toBe(200)
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
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
  109 |     await expect(saveBtn).toBeVisible()
  110 |     await expect(saveBtn).toBeEnabled()
  111 |   })
  112 | })
  113 | 
  114 | test.describe('Profile - PROF-06: unauthenticated redirect', () => {
  115 |   test('PROF-06 /profile without staging key redirects to login', async ({ page }) => {
  116 |     await page.goto('/profile')
```