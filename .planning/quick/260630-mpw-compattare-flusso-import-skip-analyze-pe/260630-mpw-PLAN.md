---
quick_id: 260630-mpw
status: locked
---

# Quick Task: Compattare flusso import — skip analyze per formato sconosciuto

## Decision

Keep `/analyze` for recognized formats (ImportPreview + confirm). Remove unknown-format stopover: redirect to `/configure`.

## Tasks

1. `isUnknownFormatAnalysis` in `lib/utils/import-status.ts`
2. Analyze page: redirect unknown → configure; keep preview path
3. Configure page: unknown-format copy + page-level back button
4. Uploader: analyze client-side, route to configure or analyze
5. Wizard step 1: back link
6. Update tests
