<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Language convention

Developer-facing code and project guidance must be written in English: identifiers, route segments, filenames, comments, test names, logs, commit-facing docs, and agent/project rules. Public app routes use English slugs (`/expenses`, `/transactions`, `/settings/patterns`); old Italian URLs may exist only as redirects isolated in `lib/routes.ts` and `next.config.ts`.

Italian is allowed only for intentional product/domain surfaces: user-facing UI copy, seeded taxonomy names/slugs, categorization regex patterns, bank-import headers/sample rows, fixtures, and localized validation messages shown to users. Run `yarn check:language` after touching routes, comments, tests, docs, or developer-facing strings.
