import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgView,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
  integer,
  serial,
  unique,
  uniqueIndex,
  numeric,
  jsonb,
  check,
} from "drizzle-orm/pg-core";

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "basic",
  "pro",
]);

export const roleEnum = pgEnum("user_role", ["user", "admin"]);

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
  firstName: varchar("first_name", { length: 80 }),
  lastName: varchar("last_name", { length: 80 }),
  jobTitle: varchar("job_title", { length: 120 }),
  location: varchar("location", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  timezone: varchar("timezone", { length: 64 }),
  passion: varchar("passion", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  subscriptionPlan: subscriptionPlanEnum("subscriptionPlan").default("free"),
  role: roleEnum("role").default("user"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
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
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    displayOrder: integer("display_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    index("category_userId_idx").on(table.userId),
    index("category_slug_idx").on(table.slug),
    uniqueIndex("category_system_slug_unique")
      .on(table.slug)
      .where(sql`${table.userId} IS NULL`),
    uniqueIndex("category_user_slug_unique")
      .on(table.userId, table.slug)
      .where(sql`${table.userId} IS NOT NULL`),
  ],
);

export const subCategory = pgTable(
  "sub_category",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    displayOrder: integer("display_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),
    natureId: integer("nature_id").references(() => nature.id, { onDelete: "set null" }),
  },
  (table) => [
    index("sub_category_userId_idx").on(table.userId),
    index("sub_category_categoryId_idx").on(table.categoryId),
    index("sub_category_natureId_idx").on(table.natureId),
    uniqueIndex("sub_category_system_category_slug_unique")
      .on(table.categoryId, table.slug)
      .where(sql`${table.userId} IS NULL`),
    uniqueIndex("sub_category_user_category_slug_unique")
      .on(table.userId, table.categoryId, table.slug)
      .where(sql`${table.userId} IS NOT NULL`),
  ],
);

export const userSubcategoryOverride = pgTable(
  "user_subcategory_override",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subCategoryId: integer("sub_category_id")
      .notNull()
      .references(() => subCategory.id, { onDelete: "cascade" }),
    customName: varchar("custom_name", { length: 100 }),
    natureId: integer("nature_id").references(() => nature.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_subcategory_override_userId_idx").on(table.userId),
    index("user_subcategory_override_subCategoryId_idx").on(table.subCategoryId),
    index("user_subcategory_override_natureId_idx").on(table.natureId),
    unique("user_subcategory_override_user_subcategory_unique").on(
      table.userId,
      table.subCategoryId,
    ),
  ],
);

// direction lookup table — 4 static rows: in | out | allocation | transfer
export const direction = pgTable(
  "direction",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    labelIt: varchar("label_it", { length: 100 }).notNull(),
    netWorthEffect: varchar("net_worth_effect", { length: 16 }).notNull(), // increase|decrease|neutral — varchar, NOT a pgEnum (lookup-not-enum contract)
    includedInTotals: boolean("included_in_totals").default(false).notNull(),
    shownSeparately: boolean("shown_separately").default(false).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    color: varchar("color", { length: 16 }),
  },
  (table) => [index("direction_code_idx").on(table.code)],
);

// nature lookup table — 8 rows (D-01); direction_id NOT NULL FK (D-02)
export const nature = pgTable(
  "nature",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    directionId: integer("direction_id")
      .notNull()
      .references(() => direction.id, { onDelete: "restrict" }),
    labelIt: varchar("label_it", { length: 100 }).notNull(),
    color: varchar("color", { length: 16 }),
    displayOrder: integer("display_order").default(0).notNull(),
  },
  (table) => [index("nature_directionId_idx").on(table.directionId)],
);

// platform holds identity only (ADR 0013). Parsing contract lives on importFormatVersion.
// ADR 0015: platform is never user-owned — visibility dropped, ownerUserId renamed to proposedByUserId.
export const platform = pgTable(
  "platform",
  {
    id: serial("id").primaryKey(),
    proposedByUserId: text("proposed_by_user_id").references(() => user.id, { onDelete: "cascade" }),
    reviewStatus: varchar("review_status", { length: 24 }).default("approved").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    country: varchar("country", { length: 2 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("platform_slug_idx").on(table.slug),
    index("platform_proposedByUserId_idx").on(table.proposedByUserId),
    index("platform_reviewStatus_idx").on(table.reviewStatus),
  ],
);

export const importFormatVersion = pgTable(
  "import_format_version",
  {
    id: serial("id").primaryKey(),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platform.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
    visibility: varchar("visibility", { length: 24 }).default("global").notNull(),
    reviewStatus: varchar("review_status", { length: 24 }).default("approved").notNull(),
    version: integer("version").default(1).notNull(),
    headerSignature: text("header_signature").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    // Parsing contract columns — owned here (ADR 0013). Nullability mirrors original platform columns.
    // notNull: delimiter, descriptionColumn, amountType, timestampColumn (were NOT NULL on platform)
    // notNull with default: dateReplace, decimalReplace, multiplyBy (had DEFAULT on platform)
    // nullable: amountColumn, positiveAmountColumn, negativeAmountColumn, dateFormat, descriptionStripPattern
    delimiter: varchar("delimiter", { length: 4 }).notNull(),
    descriptionColumn: varchar("description_column", { length: 120 }).notNull(),
    // Optional secondary description column composed as `Primary — @secondary` when present
    // (opt-in per format; nullable, no backfill). Disambiguates person-to-person rows.
    secondaryDescriptionColumn: varchar("secondary_description_column", { length: 120 }),
    amountType: amountTypeEnum("amount_type").notNull(),
    amountColumn: varchar("amount_column", { length: 120 }),
    positiveAmountColumn: varchar("positive_amount_column", { length: 120 }),
    negativeAmountColumn: varchar("negative_amount_column", { length: 120 }),
    timestampColumn: varchar("timestamp_column", { length: 120 }).notNull(),
    dateFormat: varchar("date_format", { length: 60 }),
    dateReplace: boolean("date_replace").default(false).notNull(),
    decimalReplace: boolean("decimal_replace").default(false).notNull(),
    multiplyBy: integer("multiply_by").default(1).notNull(),
    descriptionStripPattern: text("description_strip_pattern"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("import_format_version_platformId_idx").on(table.platformId),
    index("import_format_version_ownerUserId_idx").on(table.ownerUserId),
    index("import_format_version_visibility_reviewStatus_idx").on(
      table.visibility,
      table.reviewStatus,
    ),
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
    displayName: varchar("display_name", { length: 255 }),
    contentHash: varchar("content_hash", { length: 64 }),
    objectKey: text("object_key").notNull().unique(),
    mimeType: varchar("mime_type", { length: 120 }),
    sizeBytes: integer("size_bytes").notNull(),
    status: fileStatusEnum("status").default("pending_upload").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    importStartedAt: timestamp("import_started_at", { withTimezone: true }),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    rowCount: integer("row_count").default(0).notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    duplicateCount: integer("duplicate_count").default(0).notNull(),
    positiveTotal: numeric("positive_total", { precision: 12, scale: 2 }).default("0.00").notNull(),
    negativeTotal: numeric("negative_total", { precision: 12, scale: 2 }).default("0.00").notNull(),
    referenceStartedAt: timestamp("reference_started_at", { withTimezone: true }),
    referenceEndedAt: timestamp("reference_ended_at", { withTimezone: true }),
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
    index("file_userId_uploadedAt_idx").on(table.userId, table.uploadedAt),
    index("file_userId_importedAt_idx").on(table.userId, table.importedAt),
    index("file_userId_reference_range_idx").on(
      table.userId,
      table.referenceStartedAt,
      table.referenceEndedAt,
    ),
    index("file_importFormatVersionId_idx").on(table.importFormatVersionId),
    index("file_userId_contentHash_idx").on(table.userId, table.contentHash),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    descriptionHash: varchar("description_hash", { length: 64 }),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
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
    fileId: text("file_id").references(() => file.id, { onDelete: "cascade" }),
    expenseId: text("expense_id").references(() => expense.id, { onDelete: "set null" }),
    transactionHash: varchar("transaction_hash", { length: 64 }).notNull(),
    description: text("description").notNull(),
    customTitle: varchar("custom_title", { length: 255 }),
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

// Transaction pair table — DROPPED (Phase 73, ADR 0018 §1, locked decision option-b,
// migration 0030_drop_transaction_pair.sql). Was the Phase 50 1:1 explicit-pairing
// table (transactionAId = PRIMARY, transactionBId = SECONDARY); fully migrated into
// reimbursement/reimbursement_refund (migration 0029_reimbursement_backfill.sql) and
// every consumer repointed (Plans 73-01/73-03/73-04) before this table was dropped.

// Expense Group — grouping entity above intact Expenses (Phase 65, ADR 0017).
// Members keep their descriptionHash, aggregates, and Tier 2 history unchanged;
// group totals are computed at read time and are deliberately NOT persisted here
// (no totalAmount/transactionCount/firstTransactionAt/lastTransactionAt column).
export const expenseGroup = pgTable(
  "expense_group",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("expense_group_userId_idx").on(table.userId),
    index("expense_group_subCategoryId_idx").on(table.subCategoryId),
  ],
);

// Junction table: an expense belongs to at most one group at a time (D-04).
// The standalone unique on expenseId — not just the (groupId, expenseId) pair —
// is what actually enforces that invariant at the DB level.
export const expenseGroupMembership = pgTable(
  "expense_group_membership",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => expenseGroup.id, { onDelete: "cascade" }),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("expense_group_membership_group_expense_unique").on(table.groupId, table.expenseId),
    unique("expense_group_membership_expense_unique").on(table.expenseId),
    index("expense_group_membership_groupId_idx").on(table.groupId),
    index("expense_group_membership_expenseId_idx").on(table.expenseId),
  ],
);

// Reimbursement — one outflow anchor (Expense XOR Expense Group) linking N inflow refunds
// (Phase 73, ADR 0018). Generalizes the 1:1 `transactionPair` into 1:N; `transactionPair` is
// migrated into this shape and stops being the live netting source (D-06). No userId-scoped
// ownership beyond the `userId` column itself is enforced at this table — service-layer callers
// must still validate ownership via the anchor's expense/expenseGroup and refund transactions.
//
// Anchor XOR (D-03): exactly one of expenseId / expenseGroupId is set, never both, never neither.
// Enforced at the DB level by the `reimbursement_anchor_xor` CHECK constraint below (not just a
// service-level check) — an inflow-anchored reimbursement is structurally impossible (D-02).
// Group-anchor *behaviour* (netting over member transactions) is Phase 74; this phase only lands
// the shape.
export const reimbursement = pgTable(
  "reimbursement",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    expenseId: text("expense_id").references(() => expense.id, { onDelete: "cascade" }),
    expenseGroupId: integer("expense_group_id").references(() => expenseGroup.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "reimbursement_anchor_xor",
      sql`(${table.expenseId} IS NOT NULL) <> (${table.expenseGroupId} IS NOT NULL)`,
    ),
    index("reimbursement_userId_idx").on(table.userId),
    index("reimbursement_expenseId_idx").on(table.expenseId),
    index("reimbursement_expenseGroupId_idx").on(table.expenseGroupId),
    // At most one reimbursement per anchor (Expense or Expense Group) — mirrors transactionPair's
    // old at-most-once-per-side uniqueness, generalized to the anchor unit.
    uniqueIndex("reimbursement_expenseId_unique")
      .on(table.expenseId)
      .where(sql`${table.expenseId} IS NOT NULL`),
    uniqueIndex("reimbursement_expenseGroupId_unique")
      .on(table.expenseGroupId)
      .where(sql`${table.expenseGroupId} IS NOT NULL`),
  ],
);

// Reimbursement Refund — N inflow transactions linked to one reimbursement (Phase 73, ADR 0018).
// A transaction refunds at most one reimbursement (unique on transactionId) — generalizes
// transactionPair's old transaction_b_id uniqueness.
export const reimbursementRefund = pgTable(
  "reimbursement_refund",
  {
    id: serial("id").primaryKey(),
    reimbursementId: integer("reimbursement_id")
      .notNull()
      .references(() => reimbursement.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("reimbursement_refund_transactionId_unique").on(table.transactionId),
    index("reimbursement_refund_reimbursementId_idx").on(table.reimbursementId),
    index("reimbursement_refund_transactionId_idx").on(table.transactionId),
  ],
);

// Reimbursement Anchor Transaction — the frozen anchored-transaction set (Phase 75, ADR 0018
// D-08). Closes the anchor-contamination gap: import.ts upserts Expenses by
// (userId, descriptionHash), so a later same-merchant purchase would otherwise silently join the
// SAME expense_id as an already-linked anchor and inherit a share of past refunds via
// effectiveAmount()'s member resolution. Recording the exact transaction id(s) that constituted
// the anchor AT LINK TIME, and resolving effectiveAmount()'s Expense-anchor branch exclusively
// from this frozen set (never from "all transactions of the anchor's expense_id"), makes the
// import-time contamination structurally impossible: a new same-merchant transaction is never a
// row in this table, so it can never be picked up by the netting spread.
//
// Expense-anchor ONLY (D-08): a Group anchor's membership (expense_group_membership) is already
// explicit and immutable (ADR 0017 §1) and is NEVER routed through this table — Group anchors are
// out of D-08's scope and stay byte-identical to pre-Phase-75 behavior.
export const reimbursementAnchorTransaction = pgTable(
  "reimbursement_anchor_transaction",
  {
    id: serial("id").primaryKey(),
    reimbursementId: integer("reimbursement_id")
      .notNull()
      .references(() => reimbursement.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("reimbursement_anchor_transaction_reimbursement_transaction_unique").on(
      table.reimbursementId,
      table.transactionId,
    ),
    index("reimbursement_anchor_transaction_reimbursementId_idx").on(table.reimbursementId),
    index("reimbursement_anchor_transaction_transactionId_idx").on(table.transactionId),
  ],
);

// Reimbursement Refund Snapshot — the pre-link state of a refund's expense (Phase 75 Plan 03,
// ADR 0018 D-10). Recorded at link time, immediately BEFORE applyDetachCleanupTx mutates the
// refund's expense (title/descriptionHash/subCategoryId/status re-hash/recategorize), so unlink
// can restore that exact prior state (RMB-07 "reappears as a normal inflow in its own month").
// One row per reimbursement_refund link — standalone unique on reimbursementRefundId, mirroring
// expenseGroupMembership's standalone-unique convention. Written only when refund-cleanup
// actually ran (createPairTx's existing anchorSubCategoryId !== null && not-self-member guard) —
// a refund that skipped cleanup gets no snapshot row, matching "nothing to restore" on unlink.
//
// expenseId is deliberately NULLABLE with onDelete:'set null' (not cascade): this lets restore
// logic distinguish "the original expense still exists" (expenseId present — UPDATE it back) from
// "it was deleted after linking" (snapshot row present, expenseId nulled by Postgres — INSERT a
// fresh replacement expense from the snapshot's stored field values) purely by checking the
// column, with no manual existence SELECT needed.
export const reimbursementRefundSnapshot = pgTable(
  "reimbursement_refund_snapshot",
  {
    id: serial("id").primaryKey(),
    reimbursementRefundId: integer("reimbursement_refund_id")
      .notNull()
      .references(() => reimbursementRefund.id, { onDelete: "cascade" }),
    expenseId: text("expense_id").references(() => expense.id, { onDelete: "set null" }),
    expenseTitle: text("expense_title"),
    expenseDescriptionHash: varchar("expense_description_hash", { length: 64 }),
    expenseSubCategoryId: integer("expense_sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    expenseStatus: expenseStatusEnum("expense_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("reimbursement_refund_snapshot_reimbursementRefundId_unique").on(
      table.reimbursementRefundId,
    ),
    index("reimbursement_refund_snapshot_reimbursementRefundId_idx").on(
      table.reimbursementRefundId,
    ),
    index("reimbursement_refund_snapshot_expenseId_idx").on(table.expenseId),
  ],
);

// Amortization Plan — spreads ONE outflow Transaction over N uniform monthly instalments
// (Phase 77, ADR 0019 §1/§4). Unit is the single Transaction, never an Expense/Expense Group.
// Activating a plan forces a detach into a Standalone Expense (reuses ADR 0016 §2-4); months >= 2
// (D-02) is enforced both here (CHECK) and by validateMonthsForAmount (D-07, application layer).
// UNIQUE(transactionId) is the DB-level D-05 guard: at most one plan per transaction, ever.
// totalAmount is a snapshot of transaction.amount AT ACTIVATION TIME — Phase 78's AMORT-07
// drift-detection needs this fixed value, independent of any later transaction.amount edit.
export const amortizationPlan = pgTable(
  "amortization_plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    months: integer("months").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("amortization_plan_months_check", sql`${table.months} >= 2`),
    unique("amortization_plan_transactionId_unique").on(table.transactionId),
    index("amortization_plan_userId_idx").on(table.userId),
    index("amortization_plan_userId_status_idx").on(table.userId, table.status),
  ],
);

// Amortization Instalment — one materialised row per month of a plan (Phase 77, ADR 0019 §10).
// expenseId always points at the plan's Standalone Expense (shared by every instalment of that
// plan) — category derives via that Expense; there is deliberately NO subcategory snapshot here
// (D-13, transactions already carry no subcategory column). instalmentNumber is monotonic 1..N;
// UNIQUE(planId, instalmentNumber) prevents duplicate/missing rows within a plan.
export const amortizationInstalment = pgTable(
  "amortization_instalment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => amortizationPlan.id, { onDelete: "cascade" }),
    instalmentNumber: integer("instalment_number").notNull(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("amortization_instalment_instalmentNumber_check", sql`${table.instalmentNumber} >= 1`),
    unique("amortization_instalment_planId_instalmentNumber_unique").on(
      table.planId,
      table.instalmentNumber,
    ),
    index("amortization_instalment_userId_idx").on(table.userId),
    index("amortization_instalment_planId_idx").on(table.planId),
    index("amortization_instalment_expenseId_idx").on(table.expenseId),
    index("amortization_instalment_userId_occurredAt_idx").on(table.userId, table.occurredAt),
  ],
);

// ledger_entry seam (Phase 77, ADR 0019 §10, D-11) — ONE swappable row source per lens, not a
// `lens` parameter threaded through the ten aggregation functions. Resolving the amount INSIDE
// the row source is what makes the reimbursement double-netting trap (netting an instalment's
// already-resolved amount a second time) structurally impossible.
//
// Plain Postgres VIEWs (not MATERIALIZED) — decision locked at plan-time (77-01 Task 1 checkpoint):
// always-fresh reads, zero added query cost versus today's inline CTE, no refresh infrastructure
// to build or forget. Revisit only if a measured performance problem ever justifies the
// operational cost of an explicit refresh strategy.
//
// The amount-resolution SQL below is a SELF-CONTAINED, literal transcription of
// lib/dal/transaction-pairs-sql.ts's effectiveAmount()/isNotSecondary() CTE — duplicated inline,
// never imported, because drizzle.config.ts pins the schema to THIS file alone; importing the DAL
// helper here would create a schema.ts -> lib/dal -> schema.ts cycle. Every reference is a
// Drizzle table/column object already defined above in this same file (transaction, reimbursement,
// reimbursementRefund, expenseGroupMembership, reimbursementAnchorTransaction, amortizationPlan,
// amortizationInstalment) — keep both copies in sync if the netting formula ever changes.
function ledgerEntryCashAmountSql() {
  return sql`(
    ${transaction.amount}::numeric + COALESCE((
      WITH anchor AS (
        SELECT r.id AS reimbursement_id, r.expense_id, r.expense_group_id
        FROM reimbursement r
        WHERE r.expense_id = ${transaction.expenseId}
           OR r.expense_group_id = (
             SELECT egm.group_id FROM expense_group_membership egm
             WHERE egm.expense_id = ${transaction.expenseId}
           )
        LIMIT 1
      ),
      member_expense_ids AS (
        SELECT egm2.expense_id AS expense_id
        FROM anchor a
        INNER JOIN expense_group_membership egm2 ON egm2.group_id = a.expense_group_id
        WHERE a.expense_group_id IS NOT NULL
      ),
      member_transactions AS (
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        INNER JOIN reimbursement_anchor_transaction rat ON rat.transaction_id = m.id
        INNER JOIN anchor a ON a.reimbursement_id = rat.reimbursement_id
        WHERE a.expense_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
        UNION ALL
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
      ),
      refund_total AS (
        SELECT COALESCE(SUM(rt.amount::numeric), 0) AS total
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id, anchor a
        WHERE rr.reimbursement_id = a.reimbursement_id
      ),
      raw_shares AS (
        SELECT
          mt.id,
          ROUND(
            (SELECT total FROM refund_total) * mt.amount
              / NULLIF((SELECT SUM(amount) FROM member_transactions), 0),
            2
          ) AS raw_share,
          ROW_NUMBER() OVER (
            ORDER BY ABS(mt.amount) DESC, mt.occurred_at ASC, mt.id ASC
          ) AS rn
        FROM member_transactions mt
      ),
      member_shares AS (
        SELECT
          id,
          COALESCE(raw_share, 0) + CASE
            WHEN rn = 1 THEN (SELECT total FROM refund_total) - SUM(raw_share) OVER ()
            ELSE 0
          END AS final_share
        FROM raw_shares
      )
      SELECT final_share FROM member_shares WHERE id = ${transaction.id}
    ), 0)
  )`;
}

function ledgerEntryCashIsNotSecondarySql() {
  return sql`NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = ${transaction.id}
  )`;
}

// Cash lens (today's behavior, unchanged): every non-refund transaction, amount netted against
// any linked reimbursement — byte-identical to the pre-seam effectiveAmount()/isNotSecondary()
// pair (LENS-03/D-12).
export const ledgerEntryCash = pgView("ledger_entry_cash", {
  id: text("id"),
  userId: text("user_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  expenseId: text("expense_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
}).as(sql`
  SELECT
    ${transaction.id} AS id,
    ${transaction.userId} AS user_id,
    ${transaction.occurredAt} AS occurred_at,
    ${transaction.expenseId} AS expense_id,
    ${ledgerEntryCashAmountSql()} AS amount
  FROM ${transaction}
  WHERE ${ledgerEntryCashIsNotSecondarySql()}
`);

// Accrual lens (unconsumed in Phase 77 — Phase 80 wires the accrual-lens reads): branch 1 is
// ledger_entry_cash's own SELECT, additionally excluding any transaction that now has an
// amortization plan (its cost is represented by its instalments instead); branch 2 selects
// amortization_instalment rows directly, already-resolved amounts, NO further netting applied —
// D-04's activation guard means an instalment can never itself be reimbursement-involved in this
// phase. Phase 78's AMORT-06 (reimbursement reduces an open plan's remaining instalments) may
// need to revisit branch 2's no-netting assumption.
export const ledgerEntryAccrual = pgView("ledger_entry_accrual", {
  id: text("id"),
  userId: text("user_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  expenseId: text("expense_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
}).as(sql`
  SELECT
    ${transaction.id} AS id,
    ${transaction.userId} AS user_id,
    ${transaction.occurredAt} AS occurred_at,
    ${transaction.expenseId} AS expense_id,
    ${ledgerEntryCashAmountSql()} AS amount
  FROM ${transaction}
  WHERE ${ledgerEntryCashIsNotSecondarySql()}
    AND NOT EXISTS (
      SELECT 1 FROM amortization_plan ap WHERE ap.transaction_id = ${transaction.id}
    )

  UNION ALL

  SELECT
    ${amortizationInstalment.id} AS id,
    ${amortizationInstalment.userId} AS user_id,
    ${amortizationInstalment.occurredAt} AS occurred_at,
    ${amortizationInstalment.expenseId} AS expense_id,
    ${amortizationInstalment.amount}::numeric AS amount
  FROM ${amortizationInstalment}
`);

// Tag — curated entity for Transaction Tags (Phase 67, TAG-01).
// Name is displayed as typed; normalizedName is name.trim().toLowerCase(), computed by the
// service layer (Plan 67-03), never derived in the DB. The standalone unique on
// (userId, normalizedName) is the DB-level guard that makes D-02's case/whitespace-insensitive
// uniqueness race-safe (TAG-01 concurrency edge), not merely a service pre-check.
// `archived` is the only removal state — no hard-delete path exists (D-04).
export const tag = pgTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 100 }).notNull(),
    dateRangeStart: timestamp("date_range_start", { withTimezone: true }),
    dateRangeEnd: timestamp("date_range_end", { withTimezone: true }),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("tag_userId_normalizedName_unique").on(table.userId, table.normalizedName),
    index("tag_userId_idx").on(table.userId),
  ],
);

// Junction table: a transaction may carry N tags — unlike expenseGroupMembership, there is no
// standalone single-column unique on transactionId (no "one tag per transaction" rule).
// The composite unique on (tagId, transactionId) is what lets bulkAssignTags (Plan 67-04) use
// onConflictDoNothing for D-06's additive-union semantics instead of a pre-check-then-insert race.
export const transactionTag = pgTable(
  "transaction_tag",
  {
    id: serial("id").primaryKey(),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("transaction_tag_tagId_transactionId_unique").on(table.tagId, table.transactionId),
    index("transaction_tag_tagId_idx").on(table.tagId),
    index("transaction_tag_transactionId_idx").on(table.transactionId),
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
    unique("categorization_pattern_unique").on(table.pattern, table.subCategoryId),
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
  categories: many(category),
  subCategories: many(subCategory),
  subcategoryOverrides: many(userSubcategoryOverride),
  expenses: many(expense),
  files: many(file),
  platforms: many(platform),
  importFormatVersions: many(importFormatVersion),
  transactions: many(transaction),
  categorizationPatterns: many(categorizationPattern),
  expenseClassificationHistory: many(expenseClassificationHistory),
  tags: many(tag),
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

export const categoryRelations = relations(category, ({ one, many }) => ({
  owner: one(user, {
    fields: [category.userId],
    references: [user.id],
  }),
  subCategories: many(subCategory),
}));

export const subCategoryRelations = relations(subCategory, ({ one, many }) => ({
  owner: one(user, {
    fields: [subCategory.userId],
    references: [user.id],
  }),
  category: one(category, {
    fields: [subCategory.categoryId],
    references: [category.id],
  }),
  nature: one(nature, {
    fields: [subCategory.natureId],
    references: [nature.id],
  }),
  overrides: many(userSubcategoryOverride),
  expenses: many(expense),
  categorizationPatterns: many(categorizationPattern),
}));

export const userSubcategoryOverrideRelations = relations(
  userSubcategoryOverride,
  ({ one }) => ({
    user: one(user, {
      fields: [userSubcategoryOverride.userId],
      references: [user.id],
    }),
    subCategory: one(subCategory, {
      fields: [userSubcategoryOverride.subCategoryId],
      references: [subCategory.id],
    }),
    nature: one(nature, {
      fields: [userSubcategoryOverride.natureId],
      references: [nature.id],
    }),
  }),
);

export const directionRelations = relations(direction, ({ many }) => ({
  natures: many(nature),
}));

export const natureRelations = relations(nature, ({ one, many }) => ({
  direction: one(direction, {
    fields: [nature.directionId],
    references: [direction.id],
  }),
  subCategories: many(subCategory),
  overrides: many(userSubcategoryOverride),
}));

export const platformRelations = relations(platform, ({ one, many }) => ({
  owner: one(user, {
    fields: [platform.proposedByUserId],
    references: [user.id],
  }),
  importFormatVersions: many(importFormatVersion),
}));

export const importFormatVersionRelations = relations(importFormatVersion, ({ one, many }) => ({
  owner: one(user, {
    fields: [importFormatVersion.ownerUserId],
    references: [user.id],
  }),
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

export const transactionRelations = relations(transaction, ({ one, many }) => ({
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
  transactionTags: many(transactionTag),
}));

export const tagRelations = relations(tag, ({ one, many }) => ({
  user: one(user, {
    fields: [tag.userId],
    references: [user.id],
  }),
  transactionTags: many(transactionTag),
}));

export const transactionTagRelations = relations(transactionTag, ({ one }) => ({
  tag: one(tag, {
    fields: [transactionTag.tagId],
    references: [tag.id],
  }),
  transaction: one(transaction, {
    fields: [transactionTag.transactionId],
    references: [transaction.id],
  }),
}));

export const expenseGroupRelations = relations(expenseGroup, ({ one, many }) => ({
  user: one(user, {
    fields: [expenseGroup.userId],
    references: [user.id],
  }),
  subCategory: one(subCategory, {
    fields: [expenseGroup.subCategoryId],
    references: [subCategory.id],
  }),
  memberships: many(expenseGroupMembership),
}));

export const expenseGroupMembershipRelations = relations(expenseGroupMembership, ({ one }) => ({
  group: one(expenseGroup, {
    fields: [expenseGroupMembership.groupId],
    references: [expenseGroup.id],
  }),
  expense: one(expense, {
    fields: [expenseGroupMembership.expenseId],
    references: [expense.id],
  }),
}));

export const reimbursementRelations = relations(reimbursement, ({ one, many }) => ({
  user: one(user, {
    fields: [reimbursement.userId],
    references: [user.id],
  }),
  expense: one(expense, {
    fields: [reimbursement.expenseId],
    references: [expense.id],
  }),
  expenseGroup: one(expenseGroup, {
    fields: [reimbursement.expenseGroupId],
    references: [expenseGroup.id],
  }),
  refunds: many(reimbursementRefund),
  anchorTransactions: many(reimbursementAnchorTransaction),
}));

export const reimbursementRefundRelations = relations(reimbursementRefund, ({ one }) => ({
  reimbursement: one(reimbursement, {
    fields: [reimbursementRefund.reimbursementId],
    references: [reimbursement.id],
  }),
  transaction: one(transaction, {
    fields: [reimbursementRefund.transactionId],
    references: [transaction.id],
  }),
  snapshot: one(reimbursementRefundSnapshot, {
    fields: [reimbursementRefund.id],
    references: [reimbursementRefundSnapshot.reimbursementRefundId],
  }),
}))

export const reimbursementRefundSnapshotRelations = relations(
  reimbursementRefundSnapshot,
  ({ one }) => ({
    reimbursementRefund: one(reimbursementRefund, {
      fields: [reimbursementRefundSnapshot.reimbursementRefundId],
      references: [reimbursementRefund.id],
    }),
    expense: one(expense, {
      fields: [reimbursementRefundSnapshot.expenseId],
      references: [expense.id],
    }),
  }),
);

export const reimbursementAnchorTransactionRelations = relations(
  reimbursementAnchorTransaction,
  ({ one }) => ({
    reimbursement: one(reimbursement, {
      fields: [reimbursementAnchorTransaction.reimbursementId],
      references: [reimbursement.id],
    }),
    transaction: one(transaction, {
      fields: [reimbursementAnchorTransaction.transactionId],
      references: [transaction.id],
    }),
  }),
);

export const amortizationPlanRelations = relations(amortizationPlan, ({ one, many }) => ({
  user: one(user, {
    fields: [amortizationPlan.userId],
    references: [user.id],
  }),
  transaction: one(transaction, {
    fields: [amortizationPlan.transactionId],
    references: [transaction.id],
  }),
  instalments: many(amortizationInstalment),
}))

export const amortizationInstalmentRelations = relations(amortizationInstalment, ({ one }) => ({
  user: one(user, {
    fields: [amortizationInstalment.userId],
    references: [user.id],
  }),
  plan: one(amortizationPlan, {
    fields: [amortizationInstalment.planId],
    references: [amortizationPlan.id],
  }),
  expense: one(expense, {
    fields: [amortizationInstalment.expenseId],
    references: [expense.id],
  }),
}))

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
