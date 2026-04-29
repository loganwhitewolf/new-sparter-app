---
status: complete
phase: 01-design-system
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md]
started: 2026-04-24T14:30:00Z
updated: 2026-04-24T14:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Login page — layout auth minimal
expected: Apri /login. Logo "Sparter" centrato in alto, form con email + password + bottone "Accedi". Nessuna sidebar, nessun topbar. Layout centrato su sfondo bianco.
result: issue
reported: "non vedo il logo sparter. il resto è come dici te"
severity: major

### 2. Dashboard page — layout app shell (desktop)
expected: Apri /dashboard a viewport desktop (≥768px). Devi vedere: sidebar sinistra slate con voci di navigazione, topbar in alto con "Sparter" a sinistra e avatar a destra, area contenuto principale con testo "Nessuna spesa ancora".
result: pass

### 3. Sidebar — voci e ordine
expected: Nella sidebar (desktop): in alto Dashboard, Spese, Import, Categorie. Poi un separatore. In fondo Impostazioni. Ordine esatto, nessuna voce mancante o in più.
result: pass

### 4. Link attivo nella sidebar
expected: Con /dashboard aperta, la voce "Dashboard" nella sidebar appare evidenziata: bordo sinistro verde emerald + sfondo leggermente verde. Le altre voci sono in grigio.
result: pass

### 5. Topbar — logo e avatar dropdown
expected: Nella topbar: "Sparter" a sinistra. A destra un avatar (cerchio con lettera "U"). Cliccando l'avatar appare un dropdown con le voci "Profilo" e "Logout" in italiano.
result: issue
reported: "no l'avater se ci clicco non succede niente"
severity: major

### 6. Mobile bottom nav
expected: Riduci il browser a viewport mobile (<768px) o usa DevTools. La sidebar sparisce. In basso appare una barra fissa con 4 icone: Dashboard, Spese, Import, Categorie. "Impostazioni" NON è presente nella bottom nav.
result: pass

### 7. Componenti shadcn — Button e Input sul login
expected: Sul form /login: il bottone "Accedi" ha angoli leggermente arrotondati (stile New York), hover con colore più scuro. I campi email e password sono Input shadcn con bordo slate e focus ring emerald.
result: pass

### 8. Font Geist applicato
expected: Il testo nell'app usa il font Geist (sans-serif moderno, non il Times/Georgia del browser di default). Verifica nella sidebar, nel topbar o nel testo del form /login.
result: pass

### 9. Colori design token — primary emerald
expected: Il bottone "Accedi" (variant default) è verde emerald (#059669 circa). Il focus ring sugli input è verde emerald. Il bordo attivo della sidebar è verde emerald.
result: pass

## Summary

total: 9
passed: 7
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Logo 'Sparter' visibile centrato sopra il form nella pagina /login"
  status: failed
  reason: "User reported: non vedo il logo sparter. il resto è come dici te"
  severity: major
  test: 1
  root_cause: "Il <span> in app/(auth)/layout.tsx non ha text-foreground esplicito. Il colore del testo non viene ereditato correttamente in questo stacking context CSS, rendendo il testo invisibile."
  artifacts:
    - path: "app/(auth)/layout.tsx"
      issue: "<span> manca di classe text-foreground esplicita"
  missing:
    - "Aggiungere className=\"text-foreground\" allo span del logo in app/(auth)/layout.tsx"
  debug_session: ""

- truth: "Cliccando l'avatar nella topbar appare un dropdown con 'Profilo' e 'Logout'"
  status: failed
  reason: "User reported: no l'avater se ci clicco non succede niente"
  severity: major
  test: 5
  root_cause: "DropdownMenuTrigger con asChild in components/layout/topbar.tsx non funziona con il pacchetto radix-ui v4 aggregato. Il <button> figlio non riceve i trigger props Radix necessari ad aprire il pannello."
  artifacts:
    - path: "components/layout/topbar.tsx"
      issue: "DropdownMenuTrigger asChild non funziona con radix-ui v4"
  missing:
    - "Rimuovere asChild da DropdownMenuTrigger e usare DropdownMenuTrigger come wrapper diretto dell'Avatar senza il <button> intermedio"
  debug_session: ""
