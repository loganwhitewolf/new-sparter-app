# Quick Task 260701-mqh: Expand Italian supermarket regex patterns

**Goal:** Web-research missing Italian GDO chains (e.g. Penny Market) and extend the `spesa-quotidiana` grocery pattern in `scripts/seed-patterns-data.ts`.

## Tasks

### Task 1: Extend grocery supermarket alternation
- **files:** `scripts/seed-patterns-data.ts`
- **action:** Add national discount chains (Penny, In's, DPiù, Prix), organic (NaturaSì), Selex/Agorà group insegne, and high-traffic regional brands (Tuodì, Migross, Tosano, Visotto, Alì Supermercati, Tigros, Decò, etc.) using existing `\b...\b` word-boundary style. Avoid overly short/generic tokens (bare `dem`, `futura`, `sun`).
- **verify:** `yarn vitest run tests/seed-patterns.test.ts` && node sanity check on sample descriptions
- **done:** Pattern matches Penny/NaturaSì/DPiù samples; tests green
