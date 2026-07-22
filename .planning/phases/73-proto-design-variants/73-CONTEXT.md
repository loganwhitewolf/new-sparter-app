# Phase 73: proto-design-variants - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver 2–3 throwaway branding UI variants under `app/proto/` (Preview-gated via existing `PROTOTYPES_ENABLED` layout, `noindex`) so PO/stakeholder can compare and lock one production design direction (BRAND-01, BRAND-02) before any `(public)` marketing page is built.

This phase does **not** implement `(public)` layout, proxy allowlist expansion for marketing paths, production homepage, legal pages, or SEO. Those are Phases 70–73.

</domain>

<decisions>
## Implementation Decisions

### Design direction (locked)
- **D-01:** Primary direction is **A + touch of B** — “Dashboard as manifesto” (real `/dashboard/overview` screenshot as dominant visual plane) combined with editorial marketing typography and quiet atmosphere on the proto surface. Not pure lifestyle editorial; not pure app-chrome clone. — **Reversibility:** costly — Phase 75 promotes the winner into `components/marketing/*`; changing direction after promotion rewrites production marketing UI.
- **D-02:** First viewport composition: brand (Sparter) as hero-level signal + one outcome headline + one short import-first supporting line + CTA group (primary Registrati, secondary Entra) + one dominant product visual. No cards, no stat strips, no floating badges/overlays on the hero media, no Pricing.
- **D-03:** Below the fold (still in scope for the proto homepage): two short benefit blocks + closing CTA. Not a full feature dump. “Come funziona” page content is **out of this phase** (Phase 75).
- **D-04:** Positioning copy is import-first / privacy-aligned (e.g. estratti file, non “collega la banca”). Italian UI copy. Real product screenshot preferred over stock/illustration.

### Comparison UX
- **D-05:** Single hub route with `?variant=` search param + floating bottom switcher (prototype skill UI pattern), not three disconnected URLs as the primary compare UX. Suggested path: `/proto/branding` (variants A/B/C via `?variant=a|b|c`). Separate `/proto/branding-a` style routes are optional aliases only if needed for share links — hub+switcher is the review surface. — **Reversibility:** reversible
- **D-06:** Ship **three** structurally different variants inside the A+B frame (layout/hierarchy/visual weight differ — not three color tweaks). Cap at 3.

### Winner lock (BRAND-02)
- **D-07:** Record the PO pick in `app/proto/branding/NOTES.md` (same ritual as historical overview proto Notes): winning variant id, what to keep/steal from losers, explicit “do not ship” notes. That file is the handoff artifact for Phase 75. Updating REQUIREMENTS checkboxes happens at phase verification / milestone tracking — NOTES.md is the design-lock source of truth. — **Reversibility:** reversible

### Visual / brand constraints
- **D-08:** Marketing proto may use typography distinct from app Geist for editorial feel; reuse Tailwind tokens / shadcn Button where it speeds the proto. Avoid purple-on-white / purple-indigo gradients, warm-cream+terracotta serif cliché, broadsheet hairline layout, glow effects, emoji clusters.
- **D-09:** Proto stays throwaway: no tests required beyond runnable pages; no production `(public)` components extraction in this phase (extraction is Phase 75). Keep existing `app/proto/layout.tsx` gate (`force-dynamic`, `notFound` without `PROTOTYPES_ENABLED`, robots noindex).

### Claude's Discretion
- Exact three structural axes within A+B (e.g. screenshot-dominant vs split vs type-led-with-shot-below) — planner/executor invent radical differences; user did not prescribe axes beyond A+B.
- Exact Italian headline/subhead wording for the three variants (must stay import-first and honest).
- Whether to embed a static PNG/WebP screenshot asset under `app/proto/branding/` or reference a placeholder frame until a real capture is added — prefer real capture when available; placeholder labeled as such is OK for first Preview.
- Switcher chrome styling (must be clearly “proto tool”, not part of the design under review).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — BRAND-01, BRAND-02; deferred BRAND-F*; out of scope (Pricing, bank linking, Italian slugs)
- `.planning/ROADMAP.md` — Phase 73 goal; Phase 74+ boundary (do not implement public layout/proxy here)
- `.planning/PROJECT.md` — Current Milestone v2.8: proto variants before production pages
- `.planning/STATE.md` — Active focus Phase 73

### Research (v2.8)
- `.planning/research/SUMMARY.md` — Proto-first phase order; stack; pitfalls overview
- `.planning/research/ARCHITECTURE.md` — `app/proto/` pattern; promote winner → `components/marketing/`; do not ship proto paths as production URLs
- `.planning/research/FEATURES.md` — Homepage hero pattern; import-first positioning; real screenshots; anti-features
- `.planning/research/PITFALLS.md` — Proto indexed/confused with production; pricing in hero

### Existing proto infrastructure
- `app/proto/layout.tsx` — `PROTOTYPES_ENABLED` gate, `dynamic = 'force-dynamic'`, robots noindex
- `proxy.ts` — `/proto` prefix already public (session skip)
- `.planning/quick/260529-lyd-proto-public-preview/SUMMARY.md` — Established `/proto` Preview workflow + NOTES.md winner capture pattern
- `.claude/skills/prototype/UI.md` (or `~/.claude/skills/prototype/UI.md`) — `?variant=` + floating switcher; radically different variants

### Product / language constraints
- `CLAUDE.md` / `AGENTS.md` — English route slugs; Italian product copy; proto under `app/proto/*`
- `CONTEXT.md` (repo root domain vocabulary) — only if copy references dashboard/deviation terms; keep marketing language aligned with real product concepts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/proto/layout.tsx`: already gates entire subtree — new branding pages nest under it; do not reinvent env/noindex.
- shadcn `Button` / existing auth CTAs linking to `/register` and `/login`: reuse for CTA group fidelity.
- Auth brand treatment in `app/(auth)/layout.tsx` (“Sparter” text mark): baseline wordmark; proto may elevate typography beyond this for marketing only.

### Established Patterns
- Proto = throwaway, Preview-only, outside `(app)` — no session, no onboarding gate.
- Historical overview proto used NOTES.md for PO verdict after Preview review — repeat for branding.
- Research suggested `/proto/branding-{a,b,c}` separate routes; **this context overrides** to hub + `?variant=` switcher as primary compare UX (D-05).

### Integration Points
- New files under `app/proto/branding/` (page + variants + optional assets + NOTES.md).
- No changes required to `proxy.ts` for `/proto/*` (already exempt).
- Do **not** create `app/(public)/` or expand marketing `PUBLIC_ROUTES` in this phase.

</code_context>

<specifics>
## Specific Ideas

- User asked for a first version that feels “cool”; accepted recommended lock: **A + touch of B** without further gray-area interview.
- Cool = credible finance façade with atmosphere and real product visual — not generic AI SaaS purple/glow.
- User explicitly declined multi-area discuss Q&A; defaults above are the locked decisions.

</specifics>

<deferred>
## Deferred Ideas

- `(public)` layout, proxy allowlist for `/`, `/how-it-works`, `/privacy`, `/terms` — Phase 74
- Production homepage + Come funziona + `components/marketing/*` extraction — Phase 75
- Legal MDX pages — Phase 76
- SEO/sitemap/robots + session-aware header + sign-out → `/` — Phase 77
- Pricing, blog, analytics/CMP, video hero, English locale — BRAND-F* / out of scope
- Optional `motion` library — only if CSS/`tw-animate-css` insufficient after proto (research deferred)

None — discussion stayed within phase scope for deliverables; deferred items are roadmap-owned.

</deferred>

---

*Phase: 73-proto-design-variants*
*Context gathered: 2026-07-22*
