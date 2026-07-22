# PROTOTYPE — branding variants · NOTES

> Throwaway. Design-lock source of truth for Phase 71. Delete/archive after promotion.

## Domanda

Quale direzione A+B diventa la homepage di produzione?

## Come provarlo

- Locale: `PROTOTYPES_ENABLED=1 yarn dev` → `http://localhost:3000/proto/branding` (default `?variant=a`, poi `?variant=b`, `?variant=c` — o il floating switcher in basso)
- Preview: Vercel Preview URL + `/proto/branding` (env `PROTOTYPES_ENABLED` scoped su Preview)
- Senza env / in Production, `/proto/branding` restituisce 404 (gate esistente in `app/proto/layout.tsx`, invariato)

## Varianti

- **a — Shot-as-plane:** hero full-bleed edge-to-edge con lo screenshot della dashboard come sfondo, brand/headline/CTA in una banda sfumata sopra l'immagine.
- **b — Editorial split:** griglia asimmetrica a due colonne (7fr testo / 5fr immagine), il product frame è una card bordata, arrotondata e leggermente sfalsata — non a tutta larghezza come in a.
- **c — Type-led stack:** primo schermo interamente testuale (brand + headline enorme + CTA, nessuna immagine), seguito subito sotto da una banda prodotto a tutta larghezza.

## Verdetto PO (compilare dopo review)

- **Winner:** _
- **Steal from losers:** _
- **Do not ship:** _
