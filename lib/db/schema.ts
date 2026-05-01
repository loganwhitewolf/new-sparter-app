import { relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
  integer,
  serial,
  unique,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "basic",
  "pro",
]);

export const roleEnum = pgEnum("user_role", ["user", "admin"]);

export const categoryTypeEnum = pgEnum("category_type", ["in", "out", "system"]);

export const expenseStatusEnum = pgEnum("expense_status", ["1", "2", "3", "4"]);

export const fileStatusEnum = pgEnum("file_status", [
  "pending_upload",
  "uploaded",
  "analyzing",
  "analyzed",
  "importing",
  "imported",
  "failed",
]);

export const amountTypeEnum = pgEnum("amount_type", ["single", "separate"]);

export const amountSignEnum = pgEnum("amount_sign", ["positive", "negative", "any"]);

export const classificationSourceEnum = pgEnum("classification_source", [
  "system_pattern",
  "user_pattern",
  "manual",
  "override",
  "import_default",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  subscriptionPlan: subscriptionPlanEnum("subscriptionPlan").default("free"),
  role: roleEnum("role").default("user"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const category = pgTable(
  "category",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    type: categoryTypeEnum("type").notNull(),
    displayOrder: integer("display_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    index("category_slug_idx").on(table.slug),
    index("category_type_idx").on(table.type),
  ],
);

export const subCategory = pgTable(
  "sub_category",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    displayOrder: integer("display_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    index("sub_category_categoryId_idx").on(table.categoryId),
    unique("sub_category_category_slug_unique").on(table.categoryId, table.slug),
  ],
);

export const platform = pgTable(
  "platform",
  {
    id: integer("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    country: varchar("country", { length: 2 }).notNull(),
    delimiter: varchar("delimiter", { length: 4 }).notNull(),
    descriptionColumn: varchar("description_column", { length: 120 }).notNull(),
    amountType: amountTypeEnum("amount_type").notNull(),
    amountColumn: varchar("amount_column", { length: 120 }),
    positiveAmountColumn: varchar("positive_amount_column", { length: 120 }),
    negativeAmountColumn: varchar("negative_amount_column", { length: 120 }),
    timestampColumn: varchar("timestamp_column", { length: 120 }).notNull(),
    dateFormat: varchar("date_format", { length: 60 }),
    dateReplace: boolean("date_replace").default(false).notNull(),
    decimalReplace: boolean("decimal_replace").default(false).notNull(),
    multiplyBy: integer("multiply_by").default(1).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("platform_slug_idx").on(table.slug)],
);

export const importFormatVersion = pgTable(
  "import_format_version",
  {
    id: serial("id").primaryKey(),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platform.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    headerSignature: text("header_signature").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("import_format_version_platformId_idx").on(table.platformId),
    unique("import_format_version_platform_version_unique").on(table.platformId, table.version),
  ],
);

export const file = pgTable(
  "file",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    importFormatVersionId: integer("import_format_version_id").references(
      () => importFormatVersion.id,
      { onDelete: "set null" },
    ),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: varchar("mime_type", { length: 120 }),
    sizeBytes: integer("size_bytes").notNull(),
    status: fileStatusEnum("status").default("pending_upload").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    importStartedAt: timestamp("import_started_at", { withTimezone: true }),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    rowCount: integer("row_count").default(0).notNull(),
    duplicateCount: integer("duplicate_count").default(0).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("file_userId_idx").on(table.userId),
    index("file_userId_status_idx").on(table.userId, table.status),
    index("file_importFormatVersionId_idx").on(table.importFormatVersionId),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    descriptionHash: varchar("description_hash", { length: 64 }),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    transactionCount: integer("transaction_count").default(0).notNull(),
    importedFromFileId: text("imported_from_file_id").references(() => file.id, {
      onDelete: "set null",
    }),
    firstTransactionAt: timestamp("first_transaction_at", { withTimezone: true }),
    lastTransactionAt: timestamp("last_transaction_at", { withTimezone: true }),
    status: expenseStatusEnum("status").notNull().default("1"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("expense_userId_idx").on(table.userId),
    index("expense_userId_status_idx").on(table.userId, table.status),
    index("expense_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("expense_subCategoryId_idx").on(table.subCategoryId),
    index("expense_importedFromFileId_idx").on(table.importedFromFileId),
    unique("expense_userId_descriptionHash_unique").on(table.userId, table.descriptionHash),
  ],
);

export const transaction = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => file.id, { onDelete: "cascade" }),
    expenseId: text("expense_id").references(() => expense.id, { onDelete: "set null" }),
    transactionHash: varchar("transaction_hash", { length: 64 }).notNull(),
    description: text("description").notNull(),
    descriptionHash: varchar("description_hash", { length: 64 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    rowIndex: integer("row_index").notNull(),
    rawRow: jsonb("raw_row").$type<Record<string, string | number | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transaction_userId_idx").on(table.userId),
    index("transaction_fileId_idx").on(table.fileId),
    index("transaction_expenseId_idx").on(table.expenseId),
    index("transaction_userId_occurredAt_idx").on(table.userId, table.occurredAt),
    index("transaction_userId_descriptionHash_idx").on(table.userId, table.descriptionHash),
    unique("transaction_userId_transactionHash_unique").on(table.userId, table.transactionHash),
  ],
);

export const categorizationPattern = pgTable(
  "categorization_pattern",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    subCategoryId: integer("sub_category_id")
      .notNull()
      .references(() => subCategory.id, { onDelete: "cascade" }),
    amountSign: amountSignEnum("amount_sign").default("any").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 2 }).default("0.80").notNull(),
    priority: integer("priority").default(100).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("categorization_pattern_userId_idx").on(table.userId),
    index("categorization_pattern_subCategoryId_idx").on(table.subCategoryId),
    index("categorization_pattern_priority_idx").on(table.priority),
    unique("categorization_pattern_unique").on(
      table.pattern,
      table.subCategoryId,
      table.amountSign,
    ),
  ],
);

export const expenseClassificationHistory = pgTable(
  "expense_classification_history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    fromSubCategoryId: integer("from_sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    toSubCategoryId: integer("to_sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    fromStatus: expenseStatusEnum("from_status"),
    toStatus: expenseStatusEnum("to_status").notNull(),
    source: classificationSourceEnum("source").notNull(),
    patternId: integer("pattern_id").references(() => categorizationPattern.id, {
      onDelete: "set null",
    }),
    confidence: numeric("confidence", { precision: 4, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("expense_classification_history_userId_idx").on(table.userId),
    index("expense_classification_history_expenseId_idx").on(table.expenseId),
    index("expense_classification_history_patternId_idx").on(table.patternId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  expenses: many(expense),
  files: many(file),
  transactions: many(transaction),
  categorizationPatterns: many(categorizationPattern),
  expenseClassificationHistory: many(expenseClassificationHistory),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  subCategories: many(subCategory),
}));

export const subCategoryRelations = relations(subCategory, ({ one, many }) => ({
  category: one(category, {
    fields: [subCategory.categoryId],
    references: [category.id],
  }),
  expenses: many(expense),
  categorizationPatterns: many(categorizationPattern),
}));

export const platformRelations = relations(platform, ({ many }) => ({
  importFormatVersions: many(importFormatVersion),
}));

export const importFormatVersionRelations = relations(importFormatVersion, ({ one, many }) => ({
  platform: one(platform, {
    fields: [importFormatVersion.platformId],
    references: [platform.id],
  }),
  files: many(file),
}));

export const fileRelations = relations(file, ({ one, many }) => ({
  user: one(user, {
    fields: [file.userId],
    references: [user.id],
  }),
  importFormatVersion: one(importFormatVersion, {
    fields: [file.importFormatVersionId],
    references: [importFormatVersion.id],
  }),
  expenses: many(expense),
  transactions: many(transaction),
}));

export const expenseRelations = relations(expense, ({ one, many }) => ({
  user: one(user, {
    fields: [expense.userId],
    references: [user.id],
  }),
  subCategory: one(subCategory, {
    fields: [expense.subCategoryId],
    references: [subCategory.id],
  }),
  importedFromFile: one(file, {
    fields: [expense.importedFromFileId],
    references: [file.id],
  }),
  transactions: many(transaction),
  classificationHistory: many(expenseClassificationHistory),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
  user: one(user, {
    fields: [transaction.userId],
    references: [user.id],
  }),
  file: one(file, {
    fields: [transaction.fileId],
    references: [file.id],
  }),
  expense: one(expense, {
    fields: [transaction.expenseId],
    references: [expense.id],
  }),
}));

export const categorizationPatternRelations = relations(categorizationPattern, ({ one, many }) => ({
  user: one(user, {
    fields: [categorizationPattern.userId],
    references: [user.id],
  }),
  subCategory: one(subCategory, {
    fields: [categorizationPattern.subCategoryId],
    references: [subCategory.id],
  }),
  classificationHistory: many(expenseClassificationHistory),
}));

export const expenseClassificationHistoryRelations = relations(
  expenseClassificationHistory,
  ({ one }) => ({
    user: one(user, {
      fields: [expenseClassificationHistory.userId],
      references: [user.id],
    }),
    expense: one(expense, {
      fields: [expenseClassificationHistory.expenseId],
      references: [expense.id],
    }),
    fromSubCategory: one(subCategory, {
      fields: [expenseClassificationHistory.fromSubCategoryId],
      references: [subCategory.id],
    }),
    toSubCategory: one(subCategory, {
      fields: [expenseClassificationHistory.toSubCategoryId],
      references: [subCategory.id],
    }),
    pattern: one(categorizationPattern, {
      fields: [expenseClassificationHistory.patternId],
      references: [categorizationPattern.id],
    }),
  }),
);
