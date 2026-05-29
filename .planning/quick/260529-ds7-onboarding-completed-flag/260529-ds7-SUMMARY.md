---
id: 260529-ds7
slug: onboarding-completed-flag
status: complete
date: 2026-05-29
---

# Quick Task 260529-ds7: Fix onboarding redirect loop when import file deleted

## Result

All 4 tasks complete. TypeScript clean. 4 atomic commits on `develop`.

## Changes

- `lib/db/schema.ts` — `onboardingCompletedAt: timestamp` (nullable) added to `user` table
- `drizzle/migrations/0014_onboarding_completed_at.sql` — `ALTER TABLE "user" ADD COLUMN "onboarding_completed_at" timestamp with time zone;`
- `lib/dal/users.ts` — `markOnboardingCompleted` (idempotent, `isNull` guard) + `getOnboardingCompletedAt`
- `app/(app)/onboarding/page.tsx` — `await markOnboardingCompleted(userId)` before step 5 render
- `app/(app)/layout.tsx` — nested guard: redirect only when `txCount === 0 && completedAt === null`

Also committed in same session: UI fixes 2-6 (double-minus, progress bar, dark theme, done card, € position).

## Deploy note

Run `yarn db:migrate` before deploying to apply the new column.
