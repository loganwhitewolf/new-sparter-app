import { beforeEach, describe, expect, it, vi } from "vitest";

type EqCondition = { op: "eq"; column: string; value: unknown };
type NeCondition = { op: "ne"; column: string; value: unknown };
type InArrayCondition = { op: "inArray"; column: string; values: unknown[] };
type Condition =
  | EqCondition
  | NeCondition
  | InArrayCondition
  | { op: "isNull"; column: string }
  | { op: "or"; conditions: Condition[] }
  | { op: "and"; conditions: Condition[] };

type FileRow = {
  id: string;
  userId: string;
  originalName: string;
  displayName: string | null;
  objectKey: string;
  status: string;
};

type TransactionRow = {
  id: string;
  userId: string;
  fileId: string | null;
  expenseId: string | null;
  amount: string;
  occurredAt: Date;
  rawRow?: Record<string, unknown>;
};

type ExpenseRow = {
  id: string;
  userId: string;
  title: string;
  totalAmount: string;
  transactionCount: number;
  importedFromFileId: string | null;
  firstTransactionAt: Date | null;
  lastTransactionAt: Date | null;
  updatedAt?: Date;
};

type HistoryRow = {
  id: number;
  userId: string;
  expenseId: string;
  source: string;
};

type FakeState = {
  files: FileRow[];
  transactions: TransactionRow[];
  expenses: ExpenseRow[];
  histories: HistoryRow[];
};

const schema = vi.hoisted(() => {
  const table = (name: string, columns: string[]) =>
    Object.fromEntries([
      ["_table", name],
      ...columns.map((column) => [column, `${name}.${column}`]),
    ]);

  return {
    file: table("file", [
      "id",
      "userId",
      "originalName",
      "displayName",
      "objectKey",
      "status",
    ]),
    transaction: table("transaction", [
      "id",
      "userId",
      "fileId",
      "expenseId",
      "amount",
      "occurredAt",
    ]),
    expense: table("expense", [
      "id",
      "userId",
      "title",
      "totalAmount",
      "transactionCount",
      "importedFromFileId",
      "firstTransactionAt",
      "lastTransactionAt",
      "updatedAt",
    ]),
    expenseClassificationHistory: table("expenseClassificationHistory", [
      "id",
      "userId",
      "expenseId",
      "source",
    ]),
  };
});

const mocks = vi.hoisted(() => ({
  dbTransaction: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  eq: (column: string, value: unknown): Condition => ({
    op: "eq",
    column,
    value,
  }),
  ne: (column: string, value: unknown): Condition => ({
    op: "ne",
    column,
    value,
  }),
  inArray: (column: string, values: unknown[]): Condition => ({
    op: "inArray",
    column,
    values,
  }),
  isNull: (column: string): Condition => ({ op: "isNull", column }),
  or: (...conditions: Condition[]): Condition => ({ op: "or", conditions }),
  and: (...conditions: Condition[]): Condition => ({ op: "and", conditions }),
  sql: () => ({ kind: "sql" }),
}));
vi.mock("@/lib/db/schema", () => schema);
vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

let fakeDb: FakeDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return fakeDb;
  },
}));

const USER_ID = "user-test-1";
const OTHER_USER_ID = "user-test-2";
const FILE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_FILE_ID = "22222222-2222-4222-8222-222222222222";

function columnName(column: string) {
  return column.split(".")[1] ?? column;
}

function matchesCondition(
  row: Record<string, unknown>,
  condition?: Condition,
): boolean {
  if (!condition) return true;

  if (condition.op === "and")
    return condition.conditions.every((child) => matchesCondition(row, child));
  if (condition.op === "or")
    return condition.conditions.some((child) => matchesCondition(row, child));
  if (condition.op === "isNull") {
    const nullKey = columnName(condition.column);
    return row[nullKey] == null;
  }

  const key = columnName(condition.column);
  if (condition.op === "eq") return row[key] === condition.value;
  if (condition.op === "ne") return row[key] !== condition.value;
  if (condition.op === "inArray") return condition.values.includes(row[key]);
  return false;
}

function cloneState(state: FakeState): FakeState {
  return {
    files: state.files.map((row) => ({ ...row })),
    transactions: state.transactions.map((row) => ({ ...row })),
    expenses: state.expenses.map((row) => ({ ...row })),
    histories: state.histories.map((row) => ({ ...row })),
  };
}

class SelectQuery {
  private tableName = "";
  private condition: Condition | undefined;
  private isAggregateQuery = false;

  constructor(
    private readonly state: FakeState,
    private readonly shape: Record<string, unknown>,
  ) {}

  from(table: { _table: string }) {
    this.tableName = table._table;
    this.isAggregateQuery =
      "totalAmount" in this.shape && "transactionCount" in this.shape;
    return this;
  }

  where(condition: Condition) {
    this.condition = condition;
    return this;
  }

  groupBy() {
    return this;
  }

  limit() {
    return this;
  }

  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?:
      | ((value: unknown[]) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    if (this.tableName === "file") {
      return this.state.files.filter((row) =>
        matchesCondition(
          row as unknown as Record<string, unknown>,
          this.condition,
        ),
      );
    }

    if (this.tableName === "transaction") {
      const rows = this.state.transactions.filter((row) =>
        matchesCondition(
          row as unknown as Record<string, unknown>,
          this.condition,
        ),
      );

      if (!this.isAggregateQuery) {
        return rows.map((row) => ({ id: row.id, expenseId: row.expenseId }));
      }

      const grouped = new Map<string, TransactionRow[]>();
      for (const row of rows) {
        if (!row.expenseId) continue;
        grouped.set(row.expenseId, [
          ...(grouped.get(row.expenseId) ?? []),
          row,
        ]);
      }

      return [...grouped.entries()].map(([expenseId, groupedRows]) => {
        const dates = groupedRows.map((row) => row.occurredAt);
        const total = groupedRows.reduce(
          (sum, row) => sum + Number(row.amount),
          0,
        );
        return {
          expenseId,
          totalAmount: total.toFixed(2),
          transactionCount: groupedRows.length,
          firstTransactionAt: new Date(
            Math.min(...dates.map((date) => date.getTime())),
          ),
          lastTransactionAt: new Date(
            Math.max(...dates.map((date) => date.getTime())),
          ),
        };
      });
    }

    if (this.tableName === "expenseClassificationHistory") {
      return this.state.histories
        .filter((row) =>
          matchesCondition(
            row as unknown as Record<string, unknown>,
            this.condition,
          ),
        )
        .map((row) => ({ expenseId: row.expenseId }));
    }

    throw new Error(`Unexpected select table ${this.tableName}`);
  }
}

class FakeDb {
  public state: FakeState;
  public destructiveWrites: string[] = [];
  public failOnExpenseId: string | null = null;

  constructor(state: FakeState) {
    this.state = cloneState(state);
    mocks.dbTransaction.mockImplementation(
      async (callback: (tx: FakeDb) => Promise<unknown>) => {
        const snapshot = cloneState(this.state);
        const tx = new FakeDb(snapshot);
        tx.failOnExpenseId = this.failOnExpenseId;

        try {
          const result = await callback(tx);
          this.state = tx.state;
          this.destructiveWrites.push(...tx.destructiveWrites);
          return result;
        } catch (error) {
          this.destructiveWrites.push(
            ...tx.destructiveWrites.map((write) => `rolled-back:${write}`),
          );
          throw error;
        }
      },
    );
  }

  transaction(callback: (tx: FakeDb) => Promise<unknown>) {
    return mocks.dbTransaction(callback);
  }

  select(shape: Record<string, unknown>) {
    return new SelectQuery(this.state, shape);
  }

  update(table: { _table: string }) {
    return {
      set: (values: Record<string, unknown>) => ({
        where: async (condition: Condition) => {
          this.destructiveWrites.push(`update:${table._table}`);
          if (table._table !== "expense")
            throw new Error(`Unexpected update table ${table._table}`);

          const idCondition =
            condition.op === "and"
              ? condition.conditions.find(
                  (child): child is EqCondition =>
                    child.op === "eq" && child.column === schema.expense.id,
                )
              : undefined;
          if (
            this.failOnExpenseId &&
            idCondition?.value === this.failOnExpenseId
          ) {
            throw new Error("forced expense update failure");
          }

          for (const row of this.state.expenses) {
            if (
              matchesCondition(
                row as unknown as Record<string, unknown>,
                condition,
              )
            ) {
              Object.assign(row, values);
            }
          }
        },
      }),
    };
  }

  delete(table: { _table: string }) {
    return {
      where: async (condition: Condition) => {
        this.destructiveWrites.push(`delete:${table._table}`);
        if (table._table === "transaction") {
          this.state.transactions = this.state.transactions.filter(
            (row) =>
              !matchesCondition(
                row as unknown as Record<string, unknown>,
                condition,
              ),
          );
          return;
        }
        if (table._table === "expense") {
          this.state.expenses = this.state.expenses.filter(
            (row) =>
              !matchesCondition(
                row as unknown as Record<string, unknown>,
                condition,
              ),
          );
          return;
        }
        if (table._table === "file") {
          this.state.files = this.state.files.filter(
            (row) =>
              !matchesCondition(
                row as unknown as Record<string, unknown>,
                condition,
              ),
          );
          return;
        }
        throw new Error(`Unexpected delete table ${table._table}`);
      },
    };
  }
}

function baseState(overrides: Partial<FakeState> = {}): FakeState {
  const state: FakeState = {
    files: [
      {
        id: FILE_ID,
        userId: USER_ID,
        originalName: "statement.csv",
        displayName: "January statement",
        objectKey: `users/${USER_ID}/imports/${FILE_ID}.csv`,
        status: "imported",
      },
    ],
    transactions: [
      {
        id: "tx-delete",
        userId: USER_ID,
        fileId: FILE_ID,
        expenseId: "expense-delete",
        amount: "-10.00",
        occurredAt: new Date("2026-01-10"),
        rawRow: { secret: "raw csv data" },
      },
      {
        id: "tx-manual",
        userId: USER_ID,
        fileId: FILE_ID,
        expenseId: "expense-manual",
        amount: "-20.00",
        occurredAt: new Date("2026-01-11"),
      },
      {
        id: "tx-override",
        userId: USER_ID,
        fileId: FILE_ID,
        expenseId: "expense-override",
        amount: "-30.00",
        occurredAt: new Date("2026-01-12"),
      },
      {
        id: "tx-recalc-import",
        userId: USER_ID,
        fileId: FILE_ID,
        expenseId: "expense-recalc",
        amount: "-40.00",
        occurredAt: new Date("2026-01-13"),
      },
      {
        id: "tx-recalc-remaining-a",
        userId: USER_ID,
        fileId: OTHER_FILE_ID,
        expenseId: "expense-recalc",
        amount: "-4.50",
        occurredAt: new Date("2026-01-14"),
      },
      {
        id: "tx-recalc-remaining-b",
        userId: USER_ID,
        fileId: OTHER_FILE_ID,
        expenseId: "expense-recalc",
        amount: "-5.50",
        occurredAt: new Date("2026-01-15"),
      },
    ],
    expenses: [
      makeExpense("expense-delete", "-10.00", 1, FILE_ID),
      makeExpense("expense-manual", "-20.00", 1, FILE_ID),
      makeExpense("expense-override", "-30.00", 1, FILE_ID),
      makeExpense("expense-recalc", "-50.00", 3, FILE_ID),
    ],
    histories: [
      { id: 1, userId: USER_ID, expenseId: "expense-manual", source: "manual" },
      {
        id: 2,
        userId: USER_ID,
        expenseId: "expense-override",
        source: "override",
      },
      {
        id: 3,
        userId: USER_ID,
        expenseId: "expense-delete",
        source: "system_pattern",
      },
    ],
  };

  return { ...state, ...overrides };
}

function makeExpense(
  id: string,
  totalAmount: string,
  transactionCount: number,
  importedFromFileId: string | null,
): ExpenseRow {
  return {
    id,
    userId: USER_ID,
    title: id,
    totalAmount,
    transactionCount,
    importedFromFileId,
    firstTransactionAt: new Date("2026-01-10"),
    lastTransactionAt: new Date("2026-01-13"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb = new FakeDb(baseState());
});

describe("getImportDeletePreview", () => {
  it("returns sanitized impact counts and IDs without storage keys or raw rows", async () => {
    const { getImportDeletePreview } =
      await import("@/lib/services/import-deletion");

    const preview = await getImportDeletePreview({
      userId: USER_ID,
      fileId: FILE_ID,
    });

    expect(preview).toMatchObject({
      fileId: FILE_ID,
      displayName: "January statement",
      transactionCount: 4,
      affectedExpenseIds: [
        "expense-delete",
        "expense-manual",
        "expense-override",
        "expense-recalc",
      ],
      recalculatedExpenseIds: ["expense-recalc"],
      deletedExpenseIds: ["expense-delete"],
      preservedExpenseIds: ["expense-manual", "expense-override"],
      counts: {
        transactions: 4,
        affectedExpenses: 4,
        recalculatedExpenses: 1,
        deletedExpenses: 1,
        preservedExpenses: 2,
      },
    });
    expect(JSON.stringify(preview)).not.toContain("objectKey");
    expect(JSON.stringify(preview)).not.toContain("raw csv data");
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "import_deletion.preview.success",
        phase: "preview",
        fileId: FILE_ID,
        userId: USER_ID,
        status: "success",
      }),
    );
  });

  it("rejects malformed file IDs before database writes", async () => {
    const { getImportDeletePreview, ImportDeleteError } =
      await import("@/lib/services/import-deletion");

    await expect(
      getImportDeletePreview({ userId: USER_ID, fileId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ImportDeleteError);
    expect(fakeDb.destructiveWrites).toEqual([]);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "import_deletion.rejected",
        reason: "invalid_file_id",
        status: "rejected",
      }),
    );
  });

  it("rejects non-owned imports as not found", async () => {
    const { getImportDeletePreview } =
      await import("@/lib/services/import-deletion");

    await expect(
      getImportDeletePreview({ userId: OTHER_USER_ID, fileId: FILE_ID }),
    ).rejects.toMatchObject({
      code: "import_not_found",
      message: "Importazione non trovata.",
    });
    expect(fakeDb.destructiveWrites).toEqual([]);
  });

  it("rejects unsupported importing/analyzing statuses", async () => {
    fakeDb = new FakeDb(
      baseState({ files: [{ ...baseState().files[0]!, status: "importing" }] }),
    );
    const { getImportDeletePreview } =
      await import("@/lib/services/import-deletion");

    await expect(
      getImportDeletePreview({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toMatchObject({
      code: "import_not_deletable",
    });
    expect(fakeDb.destructiveWrites).toEqual([]);
  });
});

describe("deleteImport", () => {
  it("deletes linked transactions, reconciles affected expenses, preserves manual/override empties, and deletes the file last", async () => {
    const { deleteImport } = await import("@/lib/services/import-deletion");

    const result = await deleteImport({ userId: USER_ID, fileId: FILE_ID });

    expect(result).toMatchObject({
      deletedFileId: FILE_ID,
      counts: {
        transactions: 4,
        affectedExpenses: 4,
        recalculatedExpenses: 1,
        deletedExpenses: 1,
        preservedExpenses: 2,
      },
    });
    expect(fakeDb.state.transactions.map((row) => row.id)).toEqual([
      "tx-recalc-remaining-a",
      "tx-recalc-remaining-b",
    ]);
    expect(
      fakeDb.state.expenses.find((row) => row.id === "expense-delete"),
    ).toBeUndefined();

    expect(
      fakeDb.state.expenses.find((row) => row.id === "expense-recalc"),
    ).toMatchObject({
      totalAmount: "-10.00",
      transactionCount: 2,
      importedFromFileId: null,
      firstTransactionAt: new Date("2026-01-14"),
      lastTransactionAt: new Date("2026-01-15"),
    });
    expect(
      fakeDb.state.expenses.find((row) => row.id === "expense-manual"),
    ).toMatchObject({
      totalAmount: "0.00",
      transactionCount: 0,
      importedFromFileId: null,
      firstTransactionAt: null,
      lastTransactionAt: null,
    });
    expect(
      fakeDb.state.expenses.find((row) => row.id === "expense-override"),
    ).toMatchObject({
      totalAmount: "0.00",
      transactionCount: 0,
      importedFromFileId: null,
      firstTransactionAt: null,
      lastTransactionAt: null,
    });
    expect(fakeDb.state.files).toEqual([]);
    expect(fakeDb.destructiveWrites.at(-1)).toBe("delete:file");
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "import_deletion.delete.success",
        phase: "delete.file",
        status: "success",
        deletedExpenseCount: 1,
        preservedExpenseCount: 2,
      }),
    );
  });

  it("deletes an imported file with no linked transactions without touching expenses", async () => {
    fakeDb = new FakeDb(
      baseState({ transactions: [], expenses: [], histories: [] }),
    );
    const { deleteImport } = await import("@/lib/services/import-deletion");

    const result = await deleteImport({ userId: USER_ID, fileId: FILE_ID });

    expect(result.counts).toEqual({
      transactions: 0,
      affectedExpenses: 0,
      recalculatedExpenses: 0,
      deletedExpenses: 0,
      preservedExpenses: 0,
    });
    expect(fakeDb.state.files).toEqual([]);
    expect(fakeDb.destructiveWrites).toEqual([
      "delete:transaction",
      "delete:file",
    ]);
  });

  it("rejects malformed file IDs before starting a transaction", async () => {
    const { deleteImport } = await import("@/lib/services/import-deletion");

    await expect(
      deleteImport({ userId: USER_ID, fileId: "bad-id" }),
    ).rejects.toMatchObject({
      code: "invalid_file_id",
    });
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
    expect(fakeDb.destructiveWrites).toEqual([]);
  });

  it("rolls back the whole transaction when reconciliation fails mid-delete", async () => {
    fakeDb.failOnExpenseId = "expense-recalc";
    const original = cloneState(fakeDb.state);
    const { deleteImport } = await import("@/lib/services/import-deletion");

    await expect(
      deleteImport({ userId: USER_ID, fileId: FILE_ID }),
    ).rejects.toMatchObject({
      code: "delete_failed",
      message: "Impossibile eliminare l’importazione.",
    });

    expect(fakeDb.state).toEqual(original);
    expect(fakeDb.destructiveWrites).toContain(
      "rolled-back:delete:transaction",
    );
    expect(fakeDb.state.files).toHaveLength(1);
    expect(fakeDb.state.transactions).toHaveLength(
      original.transactions.length,
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "import_deletion.delete.failed",
        phase: "delete.reconcile",
        status: "failed",
        reason: "delete_failed",
      }),
    );
  });
});
