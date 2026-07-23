# Phase 74 — API Coverage

No external API integration: routing/chrome only (`lib/routes.ts`, `proxy.ts`, `app/(public)/*`).

**Declared:** 2026-07-23 (planner, api_coverage_gate)
**Scope:** Public allowlist SoT, smart-root redirect, `(public)` layout/chrome/stubs, Vitest proxy cases.
**Out of scope for coverage:** Third-party HTTP clients, OAuth providers, billing, R2 uploads, Drizzle schema/DAL, SEO endpoints.
