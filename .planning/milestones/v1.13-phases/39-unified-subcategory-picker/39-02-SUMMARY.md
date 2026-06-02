---
plan: 39-02
phase: 39-unified-subcategory-picker
status: complete
completed: 2026-06-02
---

## What was built

`components/categorization/subcategory-picker.tsx` — il componente riusabile variant E, cuore della fase.

### Design

- **Container**: `Sheet + SheetContent side="bottom"` (Radix UI, `@/components/ui/sheet` — nessuna nuova dipendenza)
- **Altezza fissa**: `h-[80vh]` mobile / `sm:h-[600px]` desktop — non cresce mai con il contenuto
- **Type chips**: Tutte / Entrate / Uscite / Trasferimenti — nessun chip Sistema (D-03)
- **Two-column master-detail**: `sm:grid-cols-[190px_1fr]` — rail sinistra (Più usate + categorie), pannello destro (tile D-style)
- **Search-collapse**: query non vuota → lista piatta filtrata
- **Mobile drill-in**: rail nascosta quando un item è attivo; pulsante ‹ Categorie per tornare
- **Output**: `onChange(String(subCategoryId))` + `onOpenChange(false)` al tap (D-07)
- **Badge Personale** per opzioni `isOwned` (D-05); nessun riferimento a FlowNature

### Self-Check

- [x] `yarn tsc --noEmit` → 0 errori
- [x] `yarn build` → OK
- [x] Nessun import da vaul/drawer
- [x] `grep "from '@/components/ui/sheet'"` → match
- [x] `grep "grid-cols-\[190px_1fr\]"` → match
- [x] SUMMARY.md committato

## Key files

- `components/categorization/subcategory-picker.tsx`
