# Decision memory

Significant project decisions across sessions. Read at the start of every session. Never contradict an entry without flagging it to the user first.

For tactical retries (commands, tooling), see `ERRORS.md`. For GSD phase-locked decisions, see `.planning/phases/*/*-CONTEXT.md`. For domain vocabulary, see `CONTEXT.md`.

## Entry template (decision)

```markdown
### YYYY-MM-DD — Short title

**Decided:** …

**Why:** …

**Rejected:**
- Option A — …
- Option B — …
```

## Session summary template

Trigger phrases: "session end", "wrapping up", "let's stop here" (see developer-profile rule 7).

```markdown
### YYYY-MM-DD — Session wrap-up

**Worked on:** …

**Completed:** …

**In progress:** …

**Decisions made:** …

**Next session priorities:** …

**GSD refs:** (optional) STATE.md · HANDOFF.json · phase SUMMARY paths
```

---

<!-- Add entries below, newest first -->

### 2026-08-06 — Telegram capture bot planted as SEED-005 (17 decisions, not planned yet)

**Decided:** Bot Telegram = cattura rapida delle sole spese **fuori estratto** (contante/mancia/pagato-a-mano), scrittura-sola con conferma prima di scrivere. Perimetro: mai ammortamento, warikan rinviato, solo uscite. Identità via tabella `telegram_account` + deep link con token monouso (mai `verifySession()` in un webhook, mai il bypass staging). Bozze in tabella `telegram_draft` (TTL 1h, `callback_data` = solo uuid per il limite di 64 byte), idempotenza dalla transizione `pending → confirmed`. Il path manuale si **allinea al get-or-create per `descriptionHash` dell'import** e diventa un servizio condiviso con la Server Action web; nuova colonna `transaction.source` (`import|manual|telegram`). Documentato in `.planning/seeds/SEED-005-telegram-capture-bot.md` (include il testo pronto di ADR 0021 e le due voci `CONTEXT.md` da applicare al build). **Stato: dormant — nessuna pianificazione avviata.**

**Why:** `contante` è una sottocategoria `transfer`, quindi oggi le spese in contanti sono invisibili al modello. Il perimetro fuori-estratto è l'unico insieme **disgiunto** dagli import: evita di costruire una riconciliazione manuale↔import (nessun meccanismo impedisce oggi il doppio conteggio). Scoperta bloccante: `insertManualTransactionTx` inserisce sempre una nuova Expense contro `expense_userId_descriptionHash_unique` (`schema.ts:420`) → il **secondo** inserimento manuale con la stessa descrizione fallisce già oggi con PG 23505 sotto un messaggio d'errore generico; il contante ripetitivo lo renderebbe immediato. L'aggregazione per hash è anche ciò che rende vero il suggerimento ("come le volte precedenti"), perché i pattern Tier 1 sono nomi di esercente bancari e non matcheranno mai `caffè`/`pane`/`parcheggio`.

**Rejected:**
- Bot come cattura di *qualunque* spesa (carta inclusa) → richiede riconciliazione manuale↔import, è una milestone a sé
- Bot come superficie mobile completa (riepiloghi, albero categorie in chat) → due front-end da mantenere; se il problema è "web app inusabile da telefono" la risposta è una PWA, non un bot
- Bot come strumento di categorizzazione delle transazioni importate → altro prodotto; inline keyboard peggiore del `SubcategoryPicker`
- Allowlist di chat id in env → non scala a migliaia di utenti e non prova la titolarità dell'account
- Parsing LLM → comprerebbe solo la data in linguaggio naturale; non determinismo e dati finanziari a terzi
- Expense standalone per voce manuale / write path dedicato al bot → due semantiche di aggregazione = numeri diversi in dashboard a seconda del canale
- Tabella di dedup su `update_id`, rate limit per utente → escalation, non requisiti d'ingresso

### 2026-07-31 — Amortization lifecycle owned by /amortizations registry

**Decided:** Transactions menu keeps only activation (`Dilaziona`) + deep-link `Visualizza spesa dilazionata`. Close / close-with-sale-or-refund / remove live exclusively on `/amortizations` open-plan row actions. `Collega rimborso` on an open amortized outflow may still open the intent dialog from the tx table (pragmatic exception).

**Why:** Detail page already redirected lifecycle to the registry; tx table still exposed Chiudi/Rimuovi. User wants one owner surface for managing dilazioni.

**Rejected:**
- B — also block Collega rimborso → registry only (extra click; deferred)
- C — duplicate lifecycle on both surfaces

### 2026-07-31 — Hard-delete expense/tx/import cascades amort + reimbursement

**Decided:** Before deleting transactions/expenses/imports, `cleanupFinanceLinksForTransactions` / `cleanupFinanceLinksForExpenses` tear down open amortization plans and reimbursements (restore refund baselines). FK alone is insufficient: reimbursement is expense-keyed (anchor tx delete left orphans); expense delete without linked txs wiped instalments via expenseId but left `amortization_plan`.

**Why:** User saw plans/rimborsi survive after deleting spese/tx/file.

**Rejected:**
- Relying only on ON DELETE CASCADE — wrong anchor table for reimbursement
- Deleting refund transactions when the anchor is removed — keep inflows, drop the link

### 2026-07-31 — Unlink rimborso must reverse open-plan reduce (AMORT-06)

**Decided:** `deletePairByTransactionId` / delete-reimbursement call `reverseOpenPlanReduceForRefundUnlinkTx` before dropping the refund link, restoring `amortization_plan.totalAmount` + future instalments. Accrual overview reads instalment amounts with no SQL netting — unlink without reverse left competenza “still reimbursed”. Also heal orphaned drift (open plan, no live reimbursement, totalAmount ≠ original tx) on overview + amortizations page load.

**Why:** `reducePlanTx` dual-writes pair + re-spread; v2.8 unlink only restored expense baseline.

**Rejected:**
- Re-netting in `ledger_entry_accrual` — would double-net while a refund is linked
- Silent reverse on closed (realize) plans — needs dedicated undo

### 2026-07-31 — Personal category create = direction only (no auto subcategory)

**Decided:** Create categoria = nome + **Direzione**. Persist `category.direction_id` (migration 0034). Do **not** auto-create a subcategory. Nature only on sottocategoria; nature pickers filtered by parent direction. Sidebar type = stored direction ?? derived from first subcategory nature.

**Why:** Category ≠ subcategory; seeding a same-name subcategory was wrong UX. Direction must live on the category row if we ask for it at create without a child.

**Rejected:**
- Auto initial subcategory with default nature — user rejected
- Nature on category create — wrong layer

### 2026-07-31 — UX contratto quick on existing branch (260731-hhv)

**Decided:** Execute quick `260731-hhv` (UX contratto feedback waves 01–03) on the already-open branch `gsd/quick-260730-o82-tx-direction-multi`. No new quick branch and no git worktree isolation for this run.

**Why:** Branch already carries related product work; user does not want additional branches for this bugfix set.

**Rejected:**
- Fresh `gsd/quick-260731-hhv-*` from `origin/main` — cleaner history, but splits WIP
- Worktree-isolated execute — would fork off remote HEAD and fight the local branch choice


### 2026-07-30 — Transactions direction multi-select, transfer off by default (260730-o82)

**Decided:** Direzione is multi-select. Absent URL `direction` ⇒ effective `in,out,allocation,unclassified` (hide transfers) with **no chips**. Chips only after user changes the filter; selecting the default set again clears the param. Cascade nature/category = union of selected directions (no transfer until opted in). Transactions only.

**Why:** Transfers are low-signal noise in the default ledger view; chips should reflect user intent, not system defaults.

**Rejected:**
- Writing default into URL on first render (chip noise)
- Changing Expenses the same way (out of scope)
- Using `q=` / status “Da categorizzare” instead of direction `unclassified`

### 2026-07-30 — Amort UX: Visualizza on detail + Tutti=all (260730-n2z)

**Decided:** (1) Detail amortized txs: only Visualizza → `/amortizations?transactionId=`; Chiudi/Rimuovi only on registry. (2) Status Tutti = open+closed (override former D-C1 open-default). (3) CTA copy Chiudi con vendita/rimborso.

**Why:** Lifecycle belongs in Ammortamenti; toolbar Tutti was lying; sale≈refund in product language.

**Rejected:**
- Keeping Chiudi/Rimuovi on detail
- Filtering via `q=` description (ambiguous)

### 2026-07-30 — Amortization refund linking + remove-reset client state (260730-m2x)

**Decided:** (1) `reducePlanTx` ("rimborso") calls `createPairTx` like `realizePlanTx` ("vendita") — same pairing mechanism. (2) "Rimuovi ammortamento" client update must clear `reimbursementId` + pairing fields (not only `amortizationPlanId`), because `TransactionTable` does not resync `loadedTransactions` from props after `router.refresh()`. (3) Dashboard movers month link → `/transactions?months=YYYY-MM` only; nature chips / cash-accrual lens have no equivalent transaction-list filters.

**Why:** Bug 2 looked like server eligibility but was stale optimistic list state; server `getAmortizationEligibility` already resets after undo.

**Rejected:**
- Threading nature/lens into the transactions link — no matching query params on `/transactions`
- Server-side eligibility changes for Bug 2 — not the root cause

### 2026-07-30 — Desktop sidebar IA Option A (operational sections)

**Decided:** Left nav grouped as Panoramica → Movimenti → Ingresso dati → Configurazione. Mobile bottom-nav / More sheet unchanged in this pass.

**Why:** Matches daily user flow (see → manage → import → configure) without forcing ledger vocabulary on the IA.

**Rejected:**
- Option B (domain contabile: Spese vs Banca) — clearer for power users, weaker for daily UX
- Option C (frequency-first unlabeled top) — demotes Rimborsi without strong evidence

### 2026-07-28 — Fineco cleanup seed-extras scoped by created_at cutoff

**Decided:** `merge-duplicate-fineco-platforms` and the delete/reassign half of `ensure-fineco-moneymap-global-format` only touch rows with `created_at < 2026-07-29T00:00:00Z`. Later Fineco platforms/formats created by users after this ship survive future `yarn db:seed-extras` runs. The global Moneymap upsert remains idempotent forever.

**Why:** Without a cutoff, re-running seed-extras would merge/delete a legitimate post-release Fineco platform (or private format on `fineco`).

**Rejected:**
- One-shot SQL migration — more correct semantically; cutoff chosen as minimal change on this branch
- Permanent sentinel/ledger — heavier; cutoff is enough for this release

### 2026-05-20 — Session wrap-up

**Worked on:** `CLAUDE.md` governance — agent conduct, developer profile, writing style, GSD alignment, portable rules, `MEMORY.md` / `ERRORS.md` workflow.

**Completed:**
- Agent conduct rules 1–7 in `.claude/developer-profile.md` (portable across repos)
- GSD reconciliation for rules 3 (approaches vs execute), 5 (`ERRORS.md` vs SUMMARY/LEARNINGS), 6–7 (`MEMORY.md` vs CONTEXT/HANDOFF/STATE)
- Option B layout: quick reference in `CLAUDE.md` + Sparter-specific detail below
- `.claude/developer-profile.md` — Andrea profile, writing style (ITA/ENG + ENG dev/GSD), tennis not golf
- `ERRORS.md`, `MEMORY.md` created with templates
- Planning paths fixed (`.gsd/` → `.planning/`)
- GSD workflow enforcement block in `CLAUDE.md`

**In progress:** Nothing blocked. Changes are local/uncommitted unless committed separately.

**Decisions made:**
- **CLAUDE.md structure:** Quick reference + project detail; personal rules in `.claude/developer-profile.md` (copy to other repos). Rejected: replacing full file with <500-word bootstrap; rejected: embedding meta-prompt in `CLAUDE.md`.
- **GSD coexistence:** Rule 3 waits for choice outside execute; inside execute follow locked `*-PLAN.md`. Rule 5/6/7 complement GSD artifacts — link, don't duplicate STATE/SUMMARY/HANDOFF.
- **Memory split:** `ERRORS.md` = tactical retries; `MEMORY.md` = decisions + session wrap-ups; `CONTEXT.md` = domain language; `*-CONTEXT.md` = phase-locked GSD decisions.

**Next session priorities:**
- Commit `CLAUDE.md`, `.claude/developer-profile.md`, `MEMORY.md`, `ERRORS.md` if satisfied with the setup
- Copy `developer-profile.md` to dotfiles or next project template
- Optionally log durable decisions from this session as separate `MEMORY.md` decision entries (not just wrap-up)
- Continue adding agent rules if needed; consider `~/.claude/CLAUDE.md` global hook for developer-profile

**GSD refs:** `.planning/STATE.md` (unchanged this session) · no `HANDOFF.json`
