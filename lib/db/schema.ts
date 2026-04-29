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
} from "drizzle-orm/pg-core";

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "basic",
  "pro",
]);

export const roleEnum = pgEnum("user_role", ["user", "admin"]);

export const categoryTypeEnum = pgEnum('category_type', ['in', 'out', 'system'])

export const expenseStatusEnum = pgEnum('expense_status', ['1', '2', '3', '4'])

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

export const category = pgTable('category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  type: categoryTypeEnum('type').notNull(),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('category_slug_idx').on(table.slug),
  index('category_type_idx').on(table.type),
])

export const subCategory = pgTable('sub_category', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('sub_category_categoryId_idx').on(table.categoryId),
  unique('sub_category_category_slug_unique').on(table.categoryId, table.slug),
])

export const expense = pgTable('expense', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  descriptionHash: varchar('description_hash', { length: 64 }),
  subCategoryId: integer('sub_category_id').references(() => subCategory.id, { onDelete: 'set null' }),
  status: expenseStatusEnum('status').notNull().default('1'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('expense_userId_idx').on(table.userId),
  index('expense_userId_status_idx').on(table.userId, table.status),
  index('expense_userId_createdAt_idx').on(table.userId, table.createdAt),
  index('expense_subCategoryId_idx').on(table.subCategoryId),
])

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  expenses: many(expense),
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
}))

export const subCategoryRelations = relations(subCategory, ({ one, many }) => ({
  category: one(category, {
    fields: [subCategory.categoryId],
    references: [category.id],
  }),
  expenses: many(expense),
}))

export const expenseRelations = relations(expense, ({ one }) => ({
  user: one(user, {
    fields: [expense.userId],
    references: [user.id],
  }),
  subCategory: one(subCategory, {
    fields: [expense.subCategoryId],
    references: [subCategory.id],
  }),
}))
