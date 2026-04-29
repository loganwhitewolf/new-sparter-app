# Phase 2: Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 02-authentication
**Areas discussed:** Campi form registrazione, UX errori autenticazione, Staging bypass scope, Password requirements

---

## Campi form registrazione

| Option | Description | Selected |
|--------|-------------|----------|
| Solo email + password | Minimo per AUTH-01. firstName/lastName in Phase 7. Meno attrito al signup. | ✓ |
| Email + password + nome | Raccoglie firstName + lastName subito per migliorare UX topbar da subito. | |
| Email + password + nome + conferma password | Come sopra più campo confirm password. | |

**User's choice:** Solo email + password  
**Notes:** Redirect post-registrazione direttamente alla /dashboard (auto-login post-signup).

---

## UX errori autenticazione

| Option | Description | Selected |
|--------|-------------|----------|
| Banner inline in cima al form | Alert rosso con messaggio sotto il titolo. Pattern shadcn standard. | ✓ |
| Errori per campo + banner globale | Ogni campo mostra il proprio errore. Più granulare ma più complesso. | |
| Toast globale in angolo | Notifica temporanea. Meno invasivo ma può essere perso su mobile. | |

**User's choice:** Banner inline in cima al form  
**Notes:** Messaggio generico per credenziali errate ("Credenziali non valide. Riprova o contatta il supporto.") — prevenzione user enumeration.

---

## Staging bypass scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ovunque STAGING_KEY sia definito | Se la variabile STAGING_KEY è presente nell'env, il bypass è attivo. | ✓ |
| Solo NODE_ENV !== 'production' | Attivo in development e test ma non su staging deploy con NODE_ENV=production. | |

**User's choice:** Ovunque STAGING_KEY sia definito  
**Notes:** Bypass è il primo check in proxy.ts, prima del JWT check Better Auth.

---

## Password requirements

| Option | Description | Selected |
|--------|-------------|----------|
| Solo lunghezza minima: 8 caratteri | Standard NIST 2023. Bassa attrito al signup. | ✓ |
| 8 caratteri + almeno 1 numero | Leggero incremento sicurezza percepita. | |
| 8 caratteri + maiuscola + numero + simbolo | Requisiti classici ma sconsigliati da NIST. Alta attrito. | |

**User's choice:** Solo lunghezza minima: 8 caratteri  
**Notes:** Validazione Zod v4: `z.string().min(8)`.

---

## Claude's Discretion

- Struttura Drizzle schema per Better Auth (generato dall'adapter)
- Cookie settings (HttpOnly, Secure, SameSite)
- Struttura route API Better Auth
- Zod v4 migration details
- JWT duration e session lifetime
- Rate limiting login attempts

## Deferred Ideas

- OAuth/social login → Out of scope v1
- Password reset via email → ENH-02 v2
- "Remember me" → sessione persiste già per default
