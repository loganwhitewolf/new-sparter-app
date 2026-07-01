---
status: complete
quick_id: 260701-mqh
date: 2026-07-01
commit: 75bb0ef
---

# Quick Task 260701-mqh — Summary

## Done

Extended the `spesa-quotidiana` grocery regex in `scripts/seed-patterns-data.ts` with **37 new alternation tokens** from web research on Italian GDO (Mediobanca 2025, Altroconsumo 2026, infofranchising.it, Wikipedia).

### Chains added

| Group | Insegne |
|-------|---------|
| Discount | Penny, In's, DPiù, Prix / Prix Quality, Leader Price |
| Bio / specialty | NaturaSì, Natura Sì, Ecoranaturasì |
| National / group | Selex, Agorà, Auchan (legacy), Simply (legacy), Intermarché |
| Regional / VéGé–ESD | Tuodì, Migross, Tosano, Visotto, Cadoro, Rossetto, Megamark, Gabrielli, Alì Supermercati, Tigros, Decò, Sidis, Aspiag, A&O, Gulliver, Castoro, Maxi D, Risparmio Casa, Paladini |
| Convenience | 7-Eleven |

Also added **Tigros** (distinct from existing `tigre`).

### Deliberately excluded (false-positive risk)

- Bare `dem`, `futura`, `sun` — too short/ambiguous in bank descriptions
- Bare `alì` — only `al[iì] super` / `supermercati al[iì]` to avoid substring hits

### Verification

- `yarn vitest run tests/seed-patterns.test.ts` — PASS
- Manual regex sanity: Penny, In's, DPiù, NaturaSì, Tuodì, Alì Super, Tigros, Deco — OK; `QUALITA ALTA` — no match

### Next step (operator)

Run `yarn db:seed-patterns` (or `:staging` / `:production`) to apply to DB.
