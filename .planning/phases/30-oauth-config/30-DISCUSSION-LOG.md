# Phase 30: oauth-config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 30-CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-21
**Phase:** 30-oauth-config
**Mode:** discuss (default)
**Areas discussed:** Guardrail removal scope, Provider activation pattern, Runbook + env.example scope

---

## Areas Discussed

### Guardrail removal scope

| Question | Options presented | Selection |
|----------|------------------|-----------|
| Cosa facciamo con lib/auth/registration.ts? | Eliminazione completa / Solo rimozione del check | Eliminazione completa |
| Qualcosa da preservare del comportamento attuale? | Pulizia netta / Lascia un commento/ADR | Pulizia netta |

**Notes:** `isRegistrationEnabled()` is only used in `signUpAction`. Full deletion confirmed — no residual references. REG-01 is a permanent removal.

### Provider activation pattern

| Question | Options presented | Selection |
|----------|------------------|-----------|
| Come attivare i provider solo quando le env var sono presenti? | Runtime guard esplicito / Affidati a Better Auth | Runtime guard esplicito |

**Notes:** Explicit conditional spread per provider. Both providers independently optional.

### Runbook + env.example scope

| Question | Options presented | Selection |
|----------|------------------|-----------|
| Quali file aggiornare per ENV-03? | Runbook + .env.example + callback URL esatti / Solo runbook | Runbook + .env.example + callback URL esatti |

**Notes:** Update `docs/deploy/vercel-supabase-r2.md` and `.env.example`. Callback URLs: `/api/auth/callback/google` and `/api/auth/callback/github`.

---

## No Corrections

All decisions confirmed on first pass.

## Deferred Ideas

None.
