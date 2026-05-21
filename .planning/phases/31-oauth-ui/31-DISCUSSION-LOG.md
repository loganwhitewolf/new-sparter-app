# Phase 31: oauth-ui - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 31-CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-21
**Phase:** 31-oauth-ui
**Mode:** discuss
**Areas discussed:** Posizione e separatore, Testo dei pulsanti, Gestione errori OAuth

---

## Area 1: Posizione e separatore

| Question | Options presented | User selection |
|----------|------------------|----------------|
| Posizione dei pulsanti social | Sopra il form con 'Oppure' sotto / Sotto il form con 'Oppure' sopra / Sotto il submit senza divisore | **Sopra il form, con 'Oppure' sotto** |
| Stile del separatore | Linea con 'Oppure' al centro / Linea con 'o continua con email' / Solo linea | **Linea con 'Oppure' al centro** |

**Decision:** Social buttons above → `— Oppure —` divider → email/password form below.

---

## Area 2: Testo dei pulsanti

| Question | Options presented | User selection |
|----------|------------------|----------------|
| Wording pulsanti | 'Continua con...' uguale su entrambe le pagine / Contestuale ('Accedi' / 'Registrati') / Sempre 'Accedi con...' | **Sempre 'Continua con Google / GitHub'** |

**Decision:** Neutral wording, same on both pages. No context-specific variants.

---

## Area 3: Gestione errori OAuth

| Question | Options presented | User selection |
|----------|------------------|----------------|
| Come mostrare errori callback OAuth | URL param ?error= → Alert inline / Messaggio generico statico / Nessuna gestione esplicita | **URL param ?error= → Alert inline** |

**Decision:** Read `searchParams.error` on login/register pages; map to Italian message; display with existing `<Alert variant="destructive">`.

---

## Claude's Discretion

The following were decided by Claude without asking the user:

- Provider detection uses server component wrapper passing `activeProviders` prop (avoids `NEXT_PUBLIC_` vars, consistent with Phase 30 server-side env decision)
- Google listed before GitHub in button order
- Shared `SocialProviderButtons` component to avoid markup duplication
- `callbackURL: '/'` after successful OAuth (lands user in app, triggers redirect to dashboard if already authenticated)

---

## Deferred Ideas

None.
