---
id: 260730-bfa
status: complete
date: 2026-07-30
---

# Summary: 260730-bfa — Sidebar sections (Option A)

## What changed

Desktop left sidebar nav is grouped into four labeled sections by operational feature type:

| Section | Items |
|---------|-------|
| Panoramica | Dashboard |
| Movimenti | Transazioni, Spese, Rimborsi, Ammortamenti |
| Ingresso dati | Importazioni |
| Configurazione | Categorie, Tag, Pattern |

- Expanded: muted uppercase section headings
- Collapsed: headings hidden; thin separators between groups; tooltips unchanged
- Profile dropdown / routes / mobile nav unchanged

## Files

- `components/layout/sidebar.tsx` — `navSections` data + sectioned render
- `tests/sidebar-sections.test.tsx` — expanded labels, hrefs, collapsed hide

## Verification

- `yarn test tests/sidebar-sections.test.tsx` — 3/3 passed
- `yarn check:language` — passed

## Deferred

- Mobile More sheet: Rimborsi / Ammortamenti still absent
- Align mobile “Altro” grouping with desktop sections

## Deviations

None — followed locked Option A from CONTEXT.md.
