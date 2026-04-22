# Requirements: Sparter

**Defined:** 2026-04-22
**Core Value:** L'utente vede in un colpo d'occhio dove vanno i suoi soldi — importa il CSV della banca, le spese si categorizzano da sole, la dashboard mostra il quadro completo.

---

## v1 Requirements

### Design System

- [ ] **DS-01**: L'app usa token di colore e tipografia coerenti (palette, scala tipografica, CSS variables Tailwind)
- [ ] **DS-02**: Sono disponibili i componenti base: Button, Input, Card, Badge, Select, Modal
- [ ] **DS-03**: Il layout shell è implementato con route group `(auth)` (pagine pubbliche) e `(app)` (shell autenticata con sidebar e topbar)

### Authentication

- [ ] **AUTH-01**: L'utente può registrarsi con email e password (hash bcrypt, validazione Zod)
- [ ] **AUTH-02**: L'utente può effettuare il login e mantenere la sessione attiva attraverso il refresh del browser (JWT, NextAuth v5)
- [ ] **AUTH-03**: Le route protette reindirizzano al login gli utenti non autenticati; l'header `x-staging-key` bypassa l'auth in ambienti non-produzione (middleware Next.js)

### Expense Management

- [ ] **EXP-01**: L'utente può creare, modificare ed eliminare manualmente una expense con titolo, subcategoria e note
- [ ] **EXP-02**: L'utente può visualizzare la lista delle expense con filtri per categoria, data e status di categorizzazione
- [ ] **EXP-03**: L'utente può selezionare multiple expense e assegnare una categoria in bulk

### Dashboard KPI

- [ ] **DASH-01**: L'utente vede l'overview del mese corrente: totalIn, totalOut, balance, savingsRate, uncategorizedCount con delta rispetto al mese precedente (esclude categoria `ignore`)
- [ ] **DASH-02**: L'utente vede il breakdown delle spese per categoria e subcategoria con percentuale sul totale, filtrabile per preset di date (last-month, last-3-months, last-6-months, this-year, last-year)
- [ ] **DASH-03**: L'utente vede il trend mensile: totalIn, totalOut, non categorizzato, ignorato per ogni mese nel periodo selezionato

### File Import

- [ ] **IMP-01**: L'utente può caricare un file CSV o Excel — il file viene caricato su Cloudflare R2 via presigned URL, con record in tabella `files` (status: pending → processing → done/error)
- [ ] **IMP-02**: Il sistema analizza il file e propone la piattaforma bancaria più compatibile in base al mapping delle colonne; l'utente può confermare o scegliere manualmente
- [ ] **IMP-03**: Prima di confermare l'import, l'utente vede un'anteprima con: numero di righe rilevate, numero di duplicati (già importati), sample di righe parsed
- [ ] **IMP-04**: Il sistema importa le transazioni con deduplicazione (transactionHash), aggrega in expense per descrizione normalizzata (descriptionHash), ed esegue la pipeline di categorizzazione (Tier 1 regex + Tier 2 history, gated per subscription)

### Import Avanzato & Categorizzazione

- [ ] **ADV-01**: L'utente con piano basic o pro può creare, modificare ed eliminare pattern regex personalizzati che vengono applicati prima dei pattern di sistema nella pipeline Tier 1
- [ ] **ADV-02**: Il sistema aggiorna `ExpenseClassificationHistory` ad ogni categorizzazione confermata manualmente; gli expense con weight >= 3 vengono auto-categorizzati via Tier 2
- [ ] **ADV-03**: I pattern regex di sistema includono Deliveroo, JustEat, Glovo e Wolt mappati alla subcategoria `take-away`
- [ ] **ADV-04**: La pipeline di auto-categorizzazione è gated per subscription: `free` = nessuna auto-categorizzazione; `basic` = Tier 1 (regex) + Tier 2 (history); `pro` = Tier 1 + Tier 2 + Tier 3 AI (riservato v2)

### User Profile

- [ ] **PROF-01**: L'utente può visualizzare e modificare le proprie informazioni personali: firstName, lastName, jobTitle, location, phone, timezone

---

## v2 Requirements

### AI Categorization

- **AI-01**: Tier 3 — le expense senza match in Tier 1 e Tier 2 vengono aggiunte a `PendingAiExpense` e processate da un job runner esterno (Trigger.dev o alternativa, spike dedicato)
- **AI-02**: Il risultato AI aggiorna expense.status=done con method='ai' e confidence score
- **AI-03**: Web enrichment per expense con confidence < 0.6

### Platform Support

- **PLAT-01**: Adapter per UniCredit (seconda banca italiana per dimensione)
- **PLAT-02**: Adapter per N26 (target demografico coincide con Sparter)
- **PLAT-03**: Column mapping UI interattiva per piattaforme non supportate (escape hatch General platform)

### Enhanced Features

- **ENH-01**: Export CSV delle transazioni categorizzate (uso fiscale: spese mediche, formazione)
- **ENH-02**: Password reset via link email (richiede email provider)
- **ENH-03**: Preferenze notifiche (notifyEmail, notifyPush, notifySms)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tracking investimenti (azioni, ETF, crypto) | Milestone separata — complessità e dominio distinti |
| AI categorization Tier 3 | Richiede job runner esterno (Trigger.dev spike) — v2 |
| Dark/light mode toggle | Complessità aggiuntiva non richiesta per v1 |
| OAuth login (Google, GitHub) | Email/password sufficiente per v1 |
| Tag su transazioni | Non selezionato — bassa priorità rispetto al core |
| Avatar upload profilo | Non selezionato per v1 |
| Ruoli admin/moderator (UI) | Schema già presente, UI gestita internamente |
| PSD2/Open Banking | Implementazioni bancarie italiane frammentate, overhead sproporzionato |
| Mobile app | Web-first — mobile come milestone separata |
| Gamification (streak, badge) | Anti-pattern per personal finance |
| Social/sharing features | Finance è privata nel mercato italiano |
| UniCredit, N26 adapters | v2 priority — non bloccante per v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 1 | Pending |
| DS-02 | Phase 1 | Pending |
| DS-03 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| EXP-01 | Phase 3 | Pending |
| EXP-02 | Phase 3 | Pending |
| EXP-03 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| IMP-01 | Phase 5 | Pending |
| IMP-02 | Phase 5 | Pending |
| IMP-03 | Phase 5 | Pending |
| IMP-04 | Phase 5 | Pending |
| ADV-01 | Phase 6 | Pending |
| ADV-02 | Phase 6 | Pending |
| ADV-03 | Phase 6 | Pending |
| ADV-04 | Phase 6 | Pending |
| PROF-01 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after initial definition*
