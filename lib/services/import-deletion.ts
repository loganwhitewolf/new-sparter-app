import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  expense,
  expenseClassificationHistory,
  file as fileTable,
  transaction as transactionTable,
} from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { toDbDecimal, toDecimal } from "@/lib/utils/decimal";

const MANUAL_PRESERVE_SOURCES = ["manual", "override"] as const;
const ZERO_AMOUNT = "0.00";

export type ImportDeleteErrorCode =
  | "invalid_file_id"
  | "import_not_found"
  | "import_not_deletable"
  | "delete_failed"
  | "preview_failed";

export class ImportDeleteError extends Error {
  constructor(
    public readonly code: ImportDeleteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportDeleteError";
  }
}

export type ImportDeletePreview = {
  fileId: string;
  displayName: string;
  transactionCount: number;
  affectedExpenseIds: string[];
  recalculatedExpenseIds: string[];
  deletedExpenseIds: string[];
  preservedExpenseIds: string[];
  counts: {
    transactions: number;
    affectedExpenses: number;
    recalculatedExpenses: number;
    deletedExpenses: number;
    preservedExpenses: number;
  };
};

export type ImportDeleteResult = ImportDeletePreview & {
  deletedFileId: string;
};

type ImportFileSummary = {
  id: string;
  status: string;
  originalName: string;
  displayName: string | null;
};

type LinkedTransactionRow = {
  id: string;
  expenseId: string | null;
};

type RemainingExpenseAggregate = {
  expenseId: string | null;
  totalAmount: string | null;
  transactionCount: number | string | bigint;
  firstTransactionAt: Date | null;
  lastTransactionAt: Date | null;
};

type ImpactPlan = ImportDeletePreview & {
  remainingByExpenseId: Map<string, RemainingExpenseAggregate>;
};

function isValidFileId(fileId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    fileId,
  );
}

function displayNameFor(fileRow: ImportFileSummary) {
  return fileRow.displayName?.trim() || fileRow.originalName;
}

function numericCount(value: number | string | bigint | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return value ?? 0;
}

function logImportDeletion(
  level: "info" | "warn" | "error",
  event: string,
  fields: {
    phase: "preview" | "delete.load" | "delete.reconcile" | "delete.file";
    userId: string;
    fileId: string;
    status: "success" | "rejected" | "failed";
    transactionCount?: number;
    affectedExpenseCount?: number;
    recalculatedExpenseCount?: number;
    deletedExpenseCount?: number;
    preservedExpenseCount?: number;
    reason?: ImportDeleteErrorCode;
    err?: unknown;
  },
) {
  const { err, ...rest } = fields;
  if (level === "error" && err !== undefined) {
    logger.error({ event, err, ...rest });
    return;
  }
  logger[level]({ event, ...rest });
}

function rejectImportDeletion(input: {
  code: ImportDeleteErrorCode;
  message: string;
  phase: "preview" | "delete.load" | "delete.reconcile" | "delete.file";
  userId: string;
  fileId: string;
}): never {
  logImportDeletion("warn", "import_deletion.rejected", {
    phase: input.phase,
    userId: input.userId,
    fileId: input.fileId,
    status: "rejected",
    reason: input.code,
  });
  throw new ImportDeleteError(input.code, input.message);
}

async function loadImportFile(
  database: DbOrTx,
  input: { userId: string; fileId: string },
) {
  const rows = await database
    .select({
      id: fileTable.id,
      status: fileTable.status,
      originalName: fileTable.originalName,
      displayName: fileTable.displayName,
    })
    .from(fileTable)
    .where(
      and(eq(fileTable.id, input.fileId), eq(fileTable.userId, input.userId)),
    )
    .limit(1);

  return rows[0] as ImportFileSummary | undefined;
}

function validateFileId(input: {
  userId: string;
  fileId: string;
  phase: "preview" | "delete.load";
}) {
  if (!isValidFileId(input.fileId)) {
    rejectImportDeletion({
      code: "invalid_file_id",
      message: "Importazione non valida.",
      phase: input.phase,
      userId: input.userId,
      fileId: input.fileId,
    });
  }
}

function validateImportedFile(
  fileRow: ImportFileSummary | undefined,
  input: { userId: string; fileId: string; phase: "preview" | "delete.load" },
) {
  if (!fileRow) {
    rejectImportDeletion({
      code: "import_not_found",
      message: "Importazione non trovata.",
      phase: input.phase,
      userId: input.userId,
      fileId: input.fileId,
    });
  }

  if (fileRow.status !== "imported") {
    rejectImportDeletion({
      code: "import_not_deletable",
      message: "Questa importazione non può essere eliminata in questo stato.",
      phase: input.phase,
      userId: input.userId,
      fileId: input.fileId,
    });
  }
}

async function loadLinkedTransactions(
  database: DbOrTx,
  input: { userId: string; fileId: string },
) {
  return database
    .select({ id: transactionTable.id, expenseId: transactionTable.expenseId })
    .from(transactionTable)
    .where(
      and(
        eq(transactionTable.userId, input.userId),
        eq(transactionTable.fileId, input.fileId),
      ),
    ) as Promise<LinkedTransactionRow[]>;
}

async function loadRemainingAggregates(
  database: DbOrTx,
  input: { userId: string; fileId: string; affectedExpenseIds: string[] },
) {
  if (input.affectedExpenseIds.length === 0) return [];

  return database
    .select({
      expenseId: transactionTable.expenseId,
      totalAmount: sql<string>`coalesce(sum(${transactionTable.amount}), 0)::text`,
      transactionCount: sql<number>`count(${transactionTable.id})::int`,
      firstTransactionAt: sql<Date | null>`min(${transactionTable.occurredAt})`,
      lastTransactionAt: sql<Date | null>`max(${transactionTable.occurredAt})`,
    })
    .from(transactionTable)
    .where(
      and(
        eq(transactionTable.userId, input.userId),
        inArray(transactionTable.expenseId, input.affectedExpenseIds),
        ne(transactionTable.fileId, input.fileId),
      ),
    )
    .groupBy(transactionTable.expenseId) as Promise<
    RemainingExpenseAggregate[]
  >;
}

async function loadManualOrOverrideExpenseIds(
  database: DbOrTx,
  input: { userId: string; affectedExpenseIds: string[] },
) {
  if (input.affectedExpenseIds.length === 0) return new Set<string>();

  const rows = await database
    .select({ expenseId: expenseClassificationHistory.expenseId })
    .from(expenseClassificationHistory)
    .where(
      and(
        eq(expenseClassificationHistory.userId, input.userId),
        inArray(
          expenseClassificationHistory.expenseId,
          input.affectedExpenseIds,
        ),
        inArray(expenseClassificationHistory.source, [
          ...MANUAL_PRESERVE_SOURCES,
        ]),
      ),
    );

  return new Set(rows.map((row) => row.expenseId));
}

async function buildImpactPlan(
  database: DbOrTx,
  input: { userId: string; fileId: string; phase: "preview" | "delete.load" },
) {
  validateFileId(input);

  const fileRow = await loadImportFile(database, input);
  validateImportedFile(fileRow, input);

  const linkedTransactions = await loadLinkedTransactions(database, input);
  const affectedExpenseIds = [
    ...new Set(
      linkedTransactions
        .map((row) => row.expenseId)
        .filter(Boolean) as string[],
    ),
  ];
  const remainingAggregates = await loadRemainingAggregates(database, {
    ...input,
    affectedExpenseIds,
  });
  const manuallyPreservedExpenseIds = await loadManualOrOverrideExpenseIds(
    database,
    {
      userId: input.userId,
      affectedExpenseIds,
    },
  );

  const remainingByExpenseId = new Map(
    remainingAggregates
      .filter((row): row is RemainingExpenseAggregate & { expenseId: string } =>
        Boolean(row.expenseId),
      )
      .map((row) => [row.expenseId, row]),
  );

  const recalculatedExpenseIds: string[] = [];
  const deletedExpenseIds: string[] = [];
  const preservedExpenseIds: string[] = [];

  for (const expenseId of affectedExpenseIds) {
    const remaining = remainingByExpenseId.get(expenseId);
    if (remaining && numericCount(remaining.transactionCount) > 0) {
      recalculatedExpenseIds.push(expenseId);
    } else if (manuallyPreservedExpenseIds.has(expenseId)) {
      preservedExpenseIds.push(expenseId);
    } else {
      deletedExpenseIds.push(expenseId);
    }
  }

  const preview: ImpactPlan = {
    fileId: input.fileId,
    displayName: displayNameFor(fileRow!),
    transactionCount: linkedTransactions.length,
    affectedExpenseIds,
    recalculatedExpenseIds,
    deletedExpenseIds,
    preservedExpenseIds,
    counts: {
      transactions: linkedTransactions.length,
      affectedExpenses: affectedExpenseIds.length,
      recalculatedExpenses: recalculatedExpenseIds.length,
      deletedExpenses: deletedExpenseIds.length,
      preservedExpenses: preservedExpenseIds.length,
    },
    remainingByExpenseId,
  };

  return preview;
}

function publicPreview(plan: ImpactPlan): ImportDeletePreview {
  return {
    fileId: plan.fileId,
    displayName: plan.displayName,
    transactionCount: plan.transactionCount,
    affectedExpenseIds: plan.affectedExpenseIds,
    recalculatedExpenseIds: plan.recalculatedExpenseIds,
    deletedExpenseIds: plan.deletedExpenseIds,
    preservedExpenseIds: plan.preservedExpenseIds,
    counts: plan.counts,
  };
}

export async function getImportDeletePreview(input: {
  userId: string;
  fileId: string;
}): Promise<ImportDeletePreview> {
  try {
    const plan = await buildImpactPlan(db, { ...input, phase: "preview" });
    logImportDeletion("info", "import_deletion.preview.success", {
      phase: "preview",
      userId: input.userId,
      fileId: input.fileId,
      status: "success",
      transactionCount: plan.counts.transactions,
      affectedExpenseCount: plan.counts.affectedExpenses,
      recalculatedExpenseCount: plan.counts.recalculatedExpenses,
      deletedExpenseCount: plan.counts.deletedExpenses,
      preservedExpenseCount: plan.counts.preservedExpenses,
    });
    return publicPreview(plan);
  } catch (error) {
    if (error instanceof ImportDeleteError) throw error;
    logImportDeletion("error", "import_deletion.preview.failed", {
      phase: "preview",
      userId: input.userId,
      fileId: input.fileId,
      status: "failed",
      reason: "preview_failed",
      err: error,
    });
    throw new ImportDeleteError(
      "preview_failed",
      "Impossibile calcolare l’impatto dell’eliminazione.",
    );
  }
}

async function updateRecalculatedExpenses(
  database: DbOrTx,
  plan: ImpactPlan,
  userId: string,
) {
  for (const expenseId of plan.recalculatedExpenseIds) {
    const aggregate = plan.remainingByExpenseId.get(expenseId);
    if (!aggregate) continue;

    await database
      .update(expense)
      .set({
        totalAmount: toDbDecimal(
          toDecimal(aggregate.totalAmount ?? ZERO_AMOUNT),
        ),
        transactionCount: numericCount(aggregate.transactionCount),
        firstTransactionAt: aggregate.firstTransactionAt,
        lastTransactionAt: aggregate.lastTransactionAt,
        importedFromFileId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)));
  }
}

async function preserveEmptyManualExpenses(
  database: DbOrTx,
  plan: ImpactPlan,
  userId: string,
) {
  for (const expenseId of plan.preservedExpenseIds) {
    await database
      .update(expense)
      .set({
        totalAmount: ZERO_AMOUNT,
        transactionCount: 0,
        firstTransactionAt: null,
        lastTransactionAt: null,
        importedFromFileId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)));
  }
}

async function deleteEmptyExpenses(
  database: DbOrTx,
  plan: ImpactPlan,
  userId: string,
) {
  if (plan.deletedExpenseIds.length === 0) return;

  await database
    .delete(expense)
    .where(
      and(
        eq(expense.userId, userId),
        inArray(expense.id, plan.deletedExpenseIds),
      ),
    );
}

export async function deleteImport(input: {
  userId: string;
  fileId: string;
}): Promise<ImportDeleteResult> {
  validateFileId({ ...input, phase: "delete.load" });

  try {
    const result = await db.transaction(async (tx) => {
      const plan = await buildImpactPlan(tx, {
        ...input,
        phase: "delete.load",
      });

      await tx
        .delete(transactionTable)
        .where(
          and(
            eq(transactionTable.userId, input.userId),
            eq(transactionTable.fileId, input.fileId),
          ),
        );

      await updateRecalculatedExpenses(tx, plan, input.userId);
      await preserveEmptyManualExpenses(tx, plan, input.userId);
      await deleteEmptyExpenses(tx, plan, input.userId);

      await tx
        .delete(fileTable)
        .where(
          and(
            eq(fileTable.id, input.fileId),
            eq(fileTable.userId, input.userId),
          ),
        );

      return {
        ...publicPreview(plan),
        deletedFileId: input.fileId,
      };
    });

    logImportDeletion("info", "import_deletion.delete.success", {
      phase: "delete.file",
      userId: input.userId,
      fileId: input.fileId,
      status: "success",
      transactionCount: result.counts.transactions,
      affectedExpenseCount: result.counts.affectedExpenses,
      recalculatedExpenseCount: result.counts.recalculatedExpenses,
      deletedExpenseCount: result.counts.deletedExpenses,
      preservedExpenseCount: result.counts.preservedExpenses,
    });

    return result;
  } catch (error) {
    if (error instanceof ImportDeleteError) throw error;
    logImportDeletion("error", "import_deletion.delete.failed", {
      phase: "delete.reconcile",
      userId: input.userId,
      fileId: input.fileId,
      status: "failed",
      reason: "delete_failed",
      err: error,
    });
    throw new ImportDeleteError(
      "delete_failed",
      "Impossibile eliminare l’importazione.",
    );
  }
}
