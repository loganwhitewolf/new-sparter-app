---
id: 260529-eh0
slug: remove-onboarding-revalidate
status: complete
date: 2026-05-29
---

# Quick Task 260529-eh0: Remove onboarding revalidatePath causing reload loop

## Root Cause

`onboardingCategorizeExpense` called `revalidatePath(APP_ROUTES.onboarding)` after each categorization. This triggered an RSC re-render of the full onboarding page for every expense categorized — producing 8 GET /onboarding requests in rapid succession and a visible "reload" during step 4.

## Fix

Removed `revalidatePath(APP_ROUTES.onboarding)` and its unused imports from `lib/actions/onboarding.ts`. The done-card client state (issue #5 fix) already handles UX locally; the DB update is the source of truth.

## Commit

`git rev-parse --short HEAD` → checked via git log
