# Quick Task 260730-bfa: Sidebar sections by feature type - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Task Boundary

Reorganize the desktop left sidebar navigation into distinct labeled sections by feature typology (Option A — operational flow). No route renames. No new features.

</domain>

<decisions>
## Implementation Decisions

### IA / grouping (Option A — locked)
- **Panoramica:** Dashboard
- **Movimenti:** Transazioni, Spese, Rimborsi, Ammortamenti
- **Ingresso dati:** Importazioni
- **Configurazione:** Categorie, Tag, Pattern

### Visual behavior
- Section labels visible only when sidebar is expanded
- When collapsed: keep icons only + tooltips; use subtle spacing/separators between groups (no section text)

### Scope
- Desktop sidebar (`components/layout/sidebar.tsx`) only
- Mobile bottom-nav / More sheet unchanged in this task (Rimborsi/Ammortamenti mobile gap deferred)

### Claude's Discretion
- Section heading typography: muted, small uppercase or semibold xs — match existing muted-foreground language
- Profile dropdown stays in bottom slot unchanged
- Prefer data-driven sections array over hard-coded JSX per group

</decisions>

<specifics>
## Specific Ideas

User chose Option A from three proposals. Labels in Italian (product surface).

</specifics>

<canonical_refs>
## Canonical References

- `components/layout/sidebar.tsx` — current flat `topNavItems`
- `docs/adr/0011-collapsible-sidebar-no-topbar.md` — collapse/tooltip constraints
- `CONTEXT.md` — domain vocabulary (Transaction vs Expense) — IA stays user-facing Italian labels

</canonical_refs>
