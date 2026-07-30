---
id: 260730-bfa
title: Sidebar sections by feature type (Option A)
status: ready
date: 2026-07-30
---

# Quick Plan: 260730-bfa — Sidebar sections

## Goal

Desktop left sidebar shows four labeled sections (Panoramica / Movimenti / Ingresso dati / Configurazione) matching Option A IA. Collapse behavior, routes, and mobile nav unchanged.

## Context

Locked decisions in `260730-bfa-CONTEXT.md`. Source of truth for items remains `APP_ROUTES` + Italian product labels.

## Tasks

### Task 1: Sectioned nav data + render

**Files:**
- `components/layout/sidebar.tsx`

**Action:**
1. Replace flat `topNavItems` with a `navSections` array:
   ```ts
   type NavItem = { href: string; label: string; icon: LucideIcon }
   type NavSection = { id: string; label: string; items: NavItem[] }

   const navSections: NavSection[] = [
     { id: 'overview', label: 'Panoramica', items: [Dashboard] },
     { id: 'movements', label: 'Movimenti', items: [Transazioni, Spese, Rimborsi, Ammortamenti] },
     { id: 'ingress', label: 'Ingresso dati', items: [Importazioni] },
     { id: 'config', label: 'Configurazione', items: [Categorie, Tag, Pattern] },
   ]
   ```
2. Render each section as a `<li>` group (or nested structure) inside the existing `<ul>`:
   - When **expanded**: small muted section heading (`text-xs font-medium text-muted-foreground`) above the links; first section may omit top margin, later sections get `mt-3` (or separator + heading).
   - When **collapsed**: hide heading text; keep a subtle visual break (`my-1` / thin `Separator` between sections except before first).
3. Preserve existing link active styles, tooltips when collapsed, `ClientMountIcon`, and bottom profile slot unchanged.
4. Accessibility: section headings as non-interactive text (or `aria-labelledby` on a group); keep `aria-label="Navigazione principale"` on `<nav>`. Prefer wrapping each section in a list group with a visible heading when expanded.

**Verify:**
- Expanded: four headings visible with correct Italian labels and item order.
- Collapsed: no section label text; all 9 links still present with tooltips.
- Profile + collapse toggle unchanged.

**Done when:** sidebar.tsx renders Option A sections; no route/path changes; TypeScript clean.

### Task 2: Smoke coverage for section labels

**Files:**
- `tests/layout.spec.ts` (or new focused unit test if e2e staging is heavy)

**Action:**
Add one desktop assertion that the sidebar exposes the four section labels when expanded (role/text: Panoramica, Movimenti, Ingresso dati, Configurazione). Keep existing collapse and `/categories` guards.

If Playwright staging deps make this flaky locally, prefer a lightweight React Testing Library unit test of `Sidebar` with mocked pathname/provider instead — same assertions.

**Verify:** test passes (or document skip reason only if env blocks e2e and unit test covers it).

**Done when:** automated check proves section labels exist in expanded sidebar.

## Out of scope

- Mobile bottom-nav / More sheet changes
- Adding Rimborsi/Ammortamenti to mobile
- Renaming routes or item labels
- ROADMAP phase work

## must_haves

- Four section labels (IT) in expanded desktop sidebar
- Item membership matches Option A exactly
- Collapsed mode: no section text clutter; links remain usable
