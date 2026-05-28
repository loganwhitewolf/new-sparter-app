# Prototype verdict — Onboarding flow

**Domanda**: quale struttura di step funziona meglio per l'onboarding primo utente?

**Vincitore: Variante B — Full-screen hero**

## Perché

- Immersiva, ogni step occupa l'intera viewport
- Grandi numeri nell'overview (Step 2) creano l'A-HA immediato
- Mobile-first naturale
- Sfondo scuro Steps 1–3 e 5, light Step 4 (categorizzazione = lavoro)

## Modifiche applicate durante la sessione

- Progress dots arricchiti con label del step corrente (`● ● ○ ○ ○  Come funziona`)
- `dark` prop sui dots per gestire Step 4 (sfondo light)

## Da fare nell'implementazione reale

- Gestire correttamente dark/light theme dell'app (Tailwind dark mode, CSS variables shadcn)
  — il prototipo usa classi hardcoded, la versione reale deve usare i token del design system
- Sostituire mock data con dati reali (DAL queries)
- Sostituire `<select>` categorizzazione con combobox shadcn (`Command` + `Popover`)
- Aggiungere badge FlowNature visibili nel dropdown (oggi solo in testo plain nell'option)
- Animazioni di transizione tra step (framer-motion o CSS transition)
- Redirect guard: `/onboarding` → check `count(transaction) === 0` (vedi ADR 0005)
- Rimuovere questo prototipo e i file _variants/ dopo il primo merge in produzione

## Riferimento design decisioni

`docs/adr/0005-first-import-onboarding-gate.md`
