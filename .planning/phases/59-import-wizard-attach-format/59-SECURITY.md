---
phase: 59
threats_total: 9
threats_open: 0
threats_closed: 9
asvs_level: 1
status: pass
---

# Security Audit — Phase 59

## Summary

All nine declared threats in the phase 59 threat register are accounted for. The seven `mitigate` threats have verifiable, correctly-placed mitigations in the cited implementation files; both `accept` threats are low-severity and documented as accepted risks with server-side authoritative guards in place.

## Threat Register

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-59-01 | Information Disclosure | high | mitigate | CLOSED | `lib/dal/import-formats.ts:239–251` — `listAttachablePlatforms` WHERE clause: `isActive=true` AND (`reviewStatus='approved'` OR (`reviewStatus='pending'` AND `proposedByUserId=userId`)). Pending platforms of other users are structurally excluded from the result set. |
| T-59-02 | Tampering | medium | mitigate | CLOSED | `lib/actions/import.ts:213–219` (`createPrivateImportFormatAction`) and `:239–245` (`listAttachablePlatformsAction`) — `userId` is resolved exclusively via `verifySession()` on the server; no client-supplied id is trusted at any call site. |
| T-59-03 | Tampering (IDOR) | high | mitigate | CLOSED | `lib/services/import-format-wizard.ts:228–245` — attach branch issues a TOCTOU SELECT with `eq(platform.id, existingPlatformId)`, `eq(isActive, true)`, and the same `approved OR (pending AND proposedByUserId=userId)` guard. If zero rows match, throws `ImportFormatWizardError('db_write_failed')` before any write occurs. |
| T-59-04 | Input Validation | medium | mitigate | CLOSED | `lib/validations/import.ts:99` — `existingPlatformId: z.number().int().positive().optional()`. Pre-processing in `lib/actions/import.ts:142–149` (`optionalPositiveInteger`) converts the FormData string to a number and returns `undefined` for empty/non-integer/non-positive values before Zod runs. |
| T-59-05 | Information Disclosure | high | mitigate | CLOSED | `lib/actions/import.ts:236–256` — `listAttachablePlatformsAction` calls `verifySession()` to obtain `userId` server-side, then passes it directly to `listAttachablePlatforms(userId)` (DAL). The comment at line 233 explicitly cites T-59-05. |
| T-59-SC | Tampering | low | accept | CLOSED | Accepted risk: no new npm/pip/cargo packages were installed in this phase. Supply-chain attack surface unchanged. |
| T-59-06 | Tampering | high | mitigate | CLOSED | `existingPlatformId` arrives from the client as a hidden input (`components/import/import-format-wizard.tsx:390`). Zod validates it (`int().positive().optional()`) in the action at `lib/actions/import.ts:193–208`. The service then runs the TOCTOU SELECT (T-59-03 evidence above) before any DB write, independent of what the client submitted. Both gates are present and correctly layered. |
| T-59-07 | Information Disclosure | medium | mitigate | CLOSED | `lib/actions/import.ts:248–249` — step 1 list is produced by `listAttachablePlatforms(userId)` (same DAL function verified for T-59-01). The WHERE clause never returns pending platforms where `proposedByUserId != userId`. |
| T-59-08 | Tampering | low | accept | CLOSED | Accepted risk: `isDuplicateName` in `components/import/import-format-wizard.tsx:253–259` is a UX-only client guard. Bypassing it causes the server-side `ilike` duplicate check (`lib/services/import-format-wizard.ts:260–266`) to throw `ImportFormatWizardError('duplicate_platform_name')` — no data corruption is possible. Documented in commit `75780e2` (gap closure plan). |

## Open Threats

None.

## Verdict

PASS: all high-severity threats (T-59-01, T-59-03, T-59-05, T-59-06) are CLOSED. No blocking-open threats. `threats_open = 0`.
