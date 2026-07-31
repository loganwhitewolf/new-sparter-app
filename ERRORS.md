# Error log

Operational retries (commands, migrations, config, tooling) that took more than two attempts. Check this file before suggesting similar tactical fixes.

For GSD-tracked work, also record phase-scoped or architectural outcomes in `.planning/phases/*/*-SUMMARY.md` (deviations) or `*-LEARNINGS.md` (decisions, patterns) — see `.claude/developer-profile.md` agent conduct rule 5.

## Entry template

```markdown
### YYYY-MM-DD — Short title

**Context:** What task or area (file, feature, command).

**What didn't work:**
- Attempt 1: …
- Attempt 2: …

**What worked instead:**
- …

**Note for next time:**
- …
```

---

<!-- Add entries below, newest first -->

### 2026-07-31 — Crea categoria fails with fake "nome già esistente" (category_id_seq)

**Context:** Bug 3.7 / quick 260731-hhv-02 — Settings → Nuova categoria personale → "Crea categoria".

**What didn't work:**
- Attempt 1: Suspect Zod / form field mismatch / `useDialogAction` — action unit tests already green.
- Attempt 2: Suspect unique slug collision messaging — real failure was `category_pkey` 23505, not slug unique.

**What worked instead:**
- Heal `category_id_seq` (and sub_category) after seed inserts with explicit ids: `setval` in `scripts/seed.ts`, DAL setval+retry on insert, additive `sync-category-serial-sequences` in `seed-extras`. Map only true slug-unique violations to the Italian duplicate-name message.

**Note for next time:**
- After any seed/migration that inserts explicit integer PKs into serial tables, verify `last_value` vs `MAX(id)` before blaming app validation.
