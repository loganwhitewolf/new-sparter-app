# Phase 32: account-linking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 32-account-linking
**Areas discussed:** Settings placement, Provider display, Linking policy, Unlink safety

---

## Settings Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Hub impostazioni | `/settings` becomes a settings hub instead of redirecting directly to categories. | ✓ |
| Pagina account diretta | `/settings` directly shows connected accounts while categories stay at `/settings/categories`. | |
| Tutto nella pagina profilo | Connected accounts are added to `/profile`, with `/settings` still focused on categories. | |

**User's choice:** Start with settings as a hub.
**Notes:** The user then clarified and changed the structure: `/settings` should be a hub with two subpages, categories and profile. Social provider management belongs in profile, not directly in the hub.

| Option | Description | Selected |
|--------|-------------|----------|
| Nuova route `/settings/profile` | Profile becomes a settings subpage; `/profile` remains a redirect/alias. | ✓ |
| Route esistente `/profile` | Hub links to `/profile` without moving the route. | |
| Entrambe reali | `/profile` and `/settings/profile` both render the same page. | |

**User's choice:** Create `/settings/profile` as the canonical route.
**Notes:** `/settings/categories` remains the canonical category/pattern settings page. `/profile` stays as a redirect/alias for compatibility. The topbar profile menu should point to `/settings/profile`.

---

## Provider Display

| Option | Description | Selected |
|--------|-------------|----------|
| Stato semplice | Show only connected/not connected state plus link/unlink actions. | ✓ |
| Email provider | Also show the provider email when available. | |
| Dettagli completi | Show account id, linked date, and scopes. | |

**User's choice:** Simple state-only display.
**Notes:** Do not expose technical provider metadata in the UI.

| Option | Description | Selected |
|--------|-------------|----------|
| Mostralo disabilitato | Show unconfigured providers as disabled rows. | |
| Nascondilo del tutto | Hide providers whose env vars are absent. | ✓ |
| Mostra solo se gia collegato | Show unconfigured providers only when already linked. | |

**User's choice:** Hide unconfigured providers.
**Notes:** Google/GitHub rows are shown only when the corresponding provider is configured.

| Option | Description | Selected |
|--------|-------------|----------|
| Si, con stato vuoto | Keep the section visible with an empty state when no provider is configured. | ✓ |
| No, nascondi tutta la sezione | Hide the whole connected accounts section. | |
| Mostra solo in development | Show empty state only in development. | |

**User's choice:** Keep the card visible with an empty state.
**Notes:** Empty state copy can be `Nessun provider social configurato.`

| Option | Description | Selected |
|--------|-------------|----------|
| Card separata | Render connected accounts as a separate card below the Account card. | ✓ |
| Dentro la card Account | Put email, plan, role, and providers in one card. | |
| Sotto il form profilo | Place connected accounts after editable profile fields. | |

**User's choice:** Separate card below Account.
**Notes:** This keeps read-only account metadata and social linking actions distinct.

---

## Linking Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Solo stessa email | Only allow linking when provider email matches the Sparter account email. | ✓ |
| Email diverse permesse | Allow provider emails that differ from the Sparter account email. | |
| Stessa email ora, diverse in futuro | Keep this phase simple and defer different-email linking. | |

**User's choice:** Same email only.
**Notes:** Do not enable Better Auth `allowDifferentEmails` for this phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre `/settings/profile` | Success and error both return to the profile settings page. | ✓ |
| Successo `/settings/profile`, errore `/login` | Success returns to profile, error returns to login. | |
| Pagina dedicata callback/status | Add a dedicated status/callback page. | |

**User's choice:** Always return to `/settings/profile`.
**Notes:** The connected accounts card should display the outcome there.

| Option | Description | Selected |
|--------|-------------|----------|
| Messaggio specifico | Explain that the provider email does not match the Sparter account email. | ✓ |
| Messaggio generico | Show a generic linking failure message. | |
| Messaggio specifico + suggerimento | Add a suggestion to sign into the provider with the same email. | |

**User's choice:** Specific mismatch message.
**Notes:** Keep the message clear and concise.

| Option | Description | Selected |
|--------|-------------|----------|
| Non mostrare Collega | Already-linked providers show only connected state and unlink action. | ✓ |
| Mostra Gia collegato disabilitato | Show a disabled already-linked action. | |
| Permetti refresh del collegamento | Relaunch OAuth to refresh provider tokens. | |

**User's choice:** Do not show `Collega` for an already-linked provider.
**Notes:** Token refresh UI is out of scope.

---

## Unlink Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsante disabilitato + spiegazione | Disable unlink when it would remove the last login method. | ✓ |
| Pulsante attivo + errore dopo click | Allow click and show an error afterward. | |
| Dialog obbligatorio prima di bloccare | Open a dialog even when the action is impossible. | |

**User's choice:** Disabled button with explanation.
**Notes:** Suggested copy: `Non puoi scollegare l'unico metodo di accesso.`

| Option | Description | Selected |
|--------|-------------|----------|
| Si, dialog di conferma | Ask for confirmation before unlinking. | ✓ |
| No, azione immediata | Unlink immediately. | |
| Conferma solo se restano solo due metodi | Confirm only in near-last-method cases. | |

**User's choice:** Confirmation dialog.
**Notes:** Unlinking is account-sensitive, so confirmation is appropriate.

| Option | Description | Selected |
|--------|-------------|----------|
| Credential password o altro provider | Password credential or another social provider counts as a remaining method. | ✓ |
| Solo altro provider social | Only another social provider counts. | |
| Solo password | Only password counts. | |

**User's choice:** Password credential or another provider.
**Notes:** This supports both email/password users and social-only users with multiple providers.

| Option | Description | Selected |
|--------|-------------|----------|
| Aggiornamento immediato + toast | Update the card immediately and show a success toast. | ✓ |
| Refresh pagina completo | Full page refresh after unlinking. | |
| Solo toast, stato aggiornato al prossimo reload | Toast only; visual state updates later. | |

**User's choice:** Immediate update plus toast.
**Notes:** Suggested toast: `Provider scollegato.`

---

## Agent's Discretion

- Exact settings hub layout.
- Exact `/profile` compatibility implementation.
- Exact success/error message transport for `/settings/profile`.
- Exact data loading split between Better Auth client calls and server-side account DAL.

## Deferred Ideas

None.
