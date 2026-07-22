---
phase: 73-proto-design-variants
reviewed: 2026-07-22T16:17:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/proto/branding/page.tsx
  - app/proto/branding/prototype-switcher.tsx
  - app/proto/branding/variant-a.tsx
  - app/proto/branding/variant-b.tsx
  - app/proto/branding/variant-c.tsx
  - app/proto/branding/fonts.ts
  - app/proto/layout.tsx
  - .next-font-google-mocks.cjs
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 73: Code Review Report

**Reviewed:** 2026-07-22T16:17:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the `/proto/branding` hub, its three structural variants, the scoped display-font module, the (unchanged-in-substance) proto gate in `app/proto/layout.tsx`, and the offline font mock added mid-phase to unblock a build. The variant-selection path is sound: `page.tsx` whitelists `?variant=` against a fixed list and never echoes the raw query string into markup, so there's no reflected-XSS surface here. `tsc --noEmit` is clean on all reviewed files.

One pre-existing robustness gap in the proto gate (`app/proto/layout.tsx`) is worth flagging even though this phase didn't touch that line — it's the only thing standing between this throwaway UI and Production, and its truthy-string check has a known JS footgun. The remaining findings are Info-level maintainability notes about intentional duplication across the three variant files, which the SUMMARY documents as a deliberate "zero cross-variant coupling" decision, not an oversight.

No Critical issues. Nothing here should block Phase 75 from proceeding.

## Warnings

### WR-01: Proto gate uses truthy-string check, not exact match — `PROTOTYPES_ENABLED="false"` would not gate

**File:** `app/proto/layout.tsx:17`
**Issue:** `if (!process.env.PROTOTYPES_ENABLED) notFound()` only guards against the variable being *unset* or empty. If an operator ever sets `PROTOTYPES_ENABLED=false` or `PROTOTYPES_ENABLED=0` in a Vercel environment (a very plausible mistake — those are the two most common "explicitly disabled" spellings), `process.env.PROTOTYPES_ENABLED` is the non-empty string `"false"`/`"0"`, which is truthy in JS, so the gate does **not** trigger and the throwaway `/proto/*` subtree stays reachable. This is the sole boundary keeping unfinished/internal UI out of Production per `CLAUDE.md` ("prototipi ... abilitati solo dove esiste l'env `PROTOTYPES_ENABLED`") and `.planning/research/PITFALLS.md`'s own "Proto enabled in Production" risk entry — that risk entry only considers "env set vs unset," not "env set to a falsy-looking string," so the mitigation as currently coded doesn't fully cover the documented threat.
This line predates Phase 73 (only the `<main>` padding was touched in `73-01`), but it is in this phase's file scope and is a real latent gap worth hardening now rather than carrying forward into Phase 75's marketing pages, which will likely copy this gate pattern.
**Fix:**
```typescript
export default function ProtoLayout({ children }: { children: ReactNode }) {
  if (process.env.PROTOTYPES_ENABLED !== '1') {
    notFound()
  }

  return <main className="min-h-screen bg-background">{children}</main>
}
```

## Info

### IN-01: Below-fold benefit copy and CTA markup duplicated verbatim across all three variants

**File:** `app/proto/branding/variant-a.tsx:39-62`, `app/proto/branding/variant-b.tsx:41-72`, `app/proto/branding/variant-c.tsx:41-64`
**Issue:** The two benefit blocks ("Categorizzazione automatica" / "Scopri le deviazioni") and the closing "Registrati" CTA section are copy-pasted with identical Italian strings across all three variant files (differing only in wrapper layout classes). This is called out in `73-02-SUMMARY.md` as an intentional decision ("Below-fold benefit blocks vary shape per variant... rather than reusing one shared component") for wrapper *shape*, but the actual copy strings themselves have no reason to be triplicated — a future copy edit (e.g. fixing a typo or A/B testing wording) now requires three synchronized edits with no compiler help to catch a missed one.
**Fix:** Extract the benefit copy (title + description pairs) into a small shared `const BENEFITS = [...]` in a sibling module (e.g. `content.ts`), and have each variant map over it with its own wrapper markup. Keep this local to `app/proto/branding/` — no need to promote to `components/marketing/*` yet per D-09. Given the whole subtree is throwaway (Phase 75 rebuilds the production version), this is a "nice to have before iterating further on copy" note, not a blocker.

### IN-02: Keyboard navigation doesn't ignore modifier-key combinations

**File:** `app/proto/branding/prototype-switcher.tsx:34-40`
**Issue:** `onKey` calls `go(-1)`/`go(1)` on any `ArrowLeft`/`ArrowRight` keydown, including when held with `Cmd`/`Ctrl`/`Alt` (e.g. `Cmd+ArrowLeft`, which some browsers/OSes use for back-navigation-like behavior or text-field jumps). On a page with no focused input this doesn't collide with anything today, but it means a reviewer using a keyboard shortcut elsewhere on the page could silently cycle the variant instead.
**Fix:**
```typescript
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const el = document.activeElement
  if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return
  if ((el as HTMLElement | null)?.isContentEditable) return
  if (e.key === 'ArrowLeft') go(-1)
  if (e.key === 'ArrowRight') go(1)
}
```

---

_Reviewed: 2026-07-22T16:17:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
