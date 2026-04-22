# Sparter

## What This Is

App di personal finance per il mercato italiano, ricostruita da zero in Next.js 16 App Router partendo da una versione Express esistente. Permette di importare estratti conto da banche e piattaforme fintech italiane, categorizzare automaticamente le spese e visualizzare KPI e dashboard di riepilogo.

## Core Value

L'utente vede in un colpo d'occhio dove vanno i suoi soldi — importa il CSV della banca, le spese si categorizzano da sole, la dashboard mostra il quadro completo.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Design system con token colore/typo e componenti base (button, input, card, layout shell)
- [ ] Auth con email/password, sessione Better Auth, route protection, bypass staging
- [ ] CRUD manuale expense: crea, modifica, categorizza, lista con filtri
- [ ] Dashboard KPI: overview mensile, breakdown categorie, trend mensile
- [ ] Import file bancari su R2: upload, analisi colonne, matching piattaforma, import transazioni
- [ ] Import avanzato: regex pattern sistema + regex custom utente, history-based categorization
- [ ] User profile: schermata impostazioni account

### Out of Scope

- Tracking investimenti (azioni, ETF, crypto) — rimandato a milestone successive
- AI categorization (Tier 3) — rimandato a v2, schema e tabella PendingAiExpense già creati in v1
- Cronjob standalone / job runner — arriva in v2 con Trigger.dev (spike dedicato)
- Upload su disco locale — sostituito da Cloudflare R2
- Assets e UserAssets — fuori scope v1
- Mobile app — web-first
- OAuth login — email/password sufficiente per v1

## Context

Migrazione da architettura Express + Sequelize a Next.js 16 App Router + Drizzle ORM. Il business logic è documentato in `docs/init/BUSINESS_LOGIC_HANDOFF.md`. I dati di seed (26 categorie, ~120 subcategorie, 6 piattaforme, 28 pattern regex) sono pronti in `docs/init/seed.ts` e vanno portati in `drizzle/seed.ts`.

**Pipeline di categorizzazione (Tier 1 + 2 in v1):**
- Tier 1 — Regex patterns (globali + custom utente): match su descrizione normalizzata, method='regex', confidence=1.0
- Tier 2 — History-based: somma weight da ExpenseClassificationHistory, soglia weight >= 3
- Tier 3 — AI: fuori scope v1, tabella PendingAiExpense creata ma batch processor arriva in v2

**Feature gates subscription:**
- free: nessuna auto-categorizzazione
- basic: Tier 1 (regex) + Tier 2 (history)
- pro: Tier 1 + Tier 2 + Tier 3 AI (solo v2)

**Regola monetaria assoluta:** mai JS nativo (+, -, *, /) sugli amount. Sempre Decimal.js.

**Localizzazione:** app in italiano, messaggi errore in italiano + inglese (Accept-Language header).

## Constraints

- **Stack**: Next.js 16 App Router, Drizzle ORM + MySQL, Better Auth, Cloudflare R2, Zod, Decimal.js, Tailwind CSS + shadcn/ui — stack fisso, non negoziabile
- **Storage**: Cloudflare R2 per tutti i file CSV/Excel (`uploads/{userId}/{fileId}.{ext}`) — nessun upload locale
- **Arithmetic**: Decimal.js obbligatorio per tutti i calcoli su amount — mai float JS nativo
- **Dedup**: transactionHash (MD5 amount+description+timestamp) per transazioni; descriptionHash per expense — logica invariante
- **DB**: schema Drizzle deve rispecchiare esattamente le entità di BUSINESS_LOGIC_HANDOFF.md

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 16 App Router invece di Express | Rimpiazza architettura Express, unifica frontend e API, deploy semplice su Railway | — Pending |
| Drizzle ORM invece di Sequelize | Type-safe, migrations con drizzle-kit, query complesse con sql template literals | — Pending |
| Better Auth invece di NextAuth | Soluzione auth moderna, API più pulita, sessioni flessibili | — Pending |
| Cloudflare R2 invece di storage locale | S3-compatible, scalabile, audit trail dei file importati | — Pending |
| Expense come aggregazione semantica | N transazioni con stessa descrizione → 1 Expense; evita duplicati di categorizzazione | — Pending |
| Regex custom utente in Fase 6 | Funzionalità avanzata, dipende dalla pipeline base già funzionante | — Pending |
| PendingAiExpense creata in v1 ma vuota | Schema pronto per v2, nessun impatto su v1 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-22 after initialization*
