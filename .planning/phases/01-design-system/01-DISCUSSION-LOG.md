# Phase 1: Design System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 01-design-system
**Areas discussed:** Navigazione sidebar, Palette & identità brand, shadcn/ui style & tipografia, Scope bootstrap progetto

---

## Navigazione sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard / Spese / Import | 3 voci core, Impostazioni in basso | |
| Dashboard / Spese / Import / Categorie | Aggiunge voce Categorie per accesso diretto all'uncategorized inbox | ✓ |
| Struttura custom | Voci personalizzate | |

**User's choice:** Dashboard / Spese / Import / Categorie + Impostazioni in fondo

---

### Badge uncategorized count

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, badge numerico | Badge sulla voce Categorie | |
| No badge | Voce normale | |
| Badge anche su Dashboard | Badge su Categorie E highlight in Dashboard | ✓ |

**User's choice:** Badge su Categorie + segnalazione in Dashboard

---

### Mobile behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom nav bar | Voci principali in bottom bar fissa | ✓ |
| Hamburger + drawer laterale | Sidebar collassabile | |
| Sidebar icone only | Ridotta a icone | |

**User's choice:** Bottom nav bar

---

### Topbar

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + avatar utente | Logo sx, avatar dx con dropdown | ✓ |
| Logo + titolo pagina + avatar | Aggiunge titolo pagina al centro | |
| Solo logo + avatar | Topbar minimal | |

**User's choice:** Logo + avatar con dropdown (Profilo, Logout)

---

## Palette & identità brand

### Brand color

| Option | Description | Selected |
|--------|-------------|----------|
| Emerald / verde | Modern, growth, fintech neobank | ✓ |
| Indigo / blu | Stabilità, professionale, bancario | |
| Neutral / slate | Minimalista, no colore brand | |

**User's choice:** Emerald-600 (#059669), base color slate

---

### Colori semantici KPI

| Option | Description | Selected |
|--------|-------------|----------|
| Verde / Rosso / Slate | Standard personal finance | ✓ |
| Verde / Arancione / Slate | Meno ansiogeno per uscite | |
| Solo intensità brand | Monocolore | |

**User's choice:** emerald-600 entrate, red-500 uscite, slate-700 neutro

---

## shadcn/ui style & tipografia

### shadcn style

| Option | Description | Selected |
|--------|-------------|----------|
| New York | Compatto, data-dense, professionale | ✓ |
| Default | Più arrotondato, consumer | |

**User's choice:** New York

---

### Font

| Option | Description | Selected |
|--------|-------------|----------|
| Geist / Geist Mono | Font Vercel, Mono per numeri finanziari | ✓ |
| Inter | Font SaaS più diffuso | |
| System font stack | Nessun font esterno | |

**User's choice:** Geist (UI) + Geist Mono (importi/KPI)

---

## Scope bootstrap progetto

### Contenuto Fase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Bootstrap completo | Next.js + tutti i pacchetti + .env.example + lib/db structure | ✓ |
| Solo UI + Next.js base | Solo frontend, no DB/Auth/Storage packages | |
| Bootstrap + schema Drizzle | Bootstrap completo + schema Drizzle già definito | |

**User's choice:** Bootstrap completo (senza schema Drizzle)

---

### Page stubs

| Option | Description | Selected |
|--------|-------------|----------|
| Solo /login e /dashboard | Minimo per navigare i due route group | ✓ |
| Tutte le pagine vuote ora | Stub per tutte le pagine future | |

**User's choice:** Solo /login e /dashboard

---

## Claude's Discretion

- Palette CSS variables complete (shades per hover, focus, muted, accent) — derivate dalla base emerald/slate
- Breakpoint esatto sidebar → bottom-nav (raccomandato: 768px)
- Struttura directory componenti UI

## Deferred Ideas

- Schema Drizzle → fasi successive
- Dark mode toggle → Out of scope v1
- Pagine stub aggiuntive → create dalle rispettive fasi
