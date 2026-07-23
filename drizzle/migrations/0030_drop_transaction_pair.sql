-- Phase 73 (D-01, D-06, ADR 0018 §1): drop the deprecated 1:1 transaction_pair table.
-- Locked decision (73-01-SUMMARY.md, Task 1 checkpoint): option-b — drop at phase end.
-- Every consumer was repointed before this migration ran:
--   - lib/dal/transaction-pairs-sql.ts (effectiveAmount/isNotSecondary)  — Plan 73-01
--   - lib/dal/transactions.ts, lib/services/transaction-edit.ts         — Plan 73-03
--   - lib/services/transaction-pairs.ts, lib/dal/transaction-pairs.ts   — Plan 73-04 Tasks 1-2
-- Row content was already migrated into reimbursement/reimbursement_refund by migration
-- 0029_reimbursement_backfill.sql. This migration only drops the now-dormant, unread table.
DROP TABLE "transaction_pair";
