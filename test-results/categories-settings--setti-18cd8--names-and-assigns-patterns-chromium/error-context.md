# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: categories-settings.spec.ts >> /settings/categories acceptance flow >> creates, renames, blocks unsafe deletion, deletes safe rows, overrides system names, and assigns patterns
- Location: tests/categories-settings.spec.ts:126:7

# Error details

```
Error: Failed query: delete from "categorization_pattern" where ("categorization_pattern"."user_id" = $1 and ("categorization_pattern"."pattern" like $2 or "categorization_pattern"."description" like $3))
params: staging-user,s03-%,S03 mpckcdbr%
```

# Test source

```ts
  1   | import { randomUUID } from 'node:crypto'
  2   | import { drizzle } from 'drizzle-orm/node-postgres'
  3   | import { Pool } from 'pg'
  4   | import { and, eq, isNull, like, or, sql } from 'drizzle-orm'
  5   | import { getDatabasePoolConfig } from '@/lib/db/config'
  6   | import {
  7   |   categorizationPattern,
  8   |   category,
  9   |   expense,
  10  |   subCategory,
  11  |   user,
  12  |   userSubcategoryOverride,
  13  | } from '@/lib/db/schema'
  14  | 
  15  | export type CategorySettingsSeed = {
  16  |   userId: string
  17  |   runId: string
  18  |   prefix: string
  19  |   createdCategoryName: string
  20  |   createdCategoryRenamedName: string
  21  |   createdSubcategoryName: string
  22  |   createdSubcategoryRenamedName: string
  23  |   linkedCategoryName: string
  24  |   linkedSubcategoryName: string
  25  |   unlinkedCategoryName: string
  26  |   unlinkedSubcategoryName: string
  27  |   systemSubcategoryOriginalName: string
  28  |   systemSubcategoryOverrideName: string
  29  |   pattern: string
  30  |   patternDescription: string
  31  | }
  32  | 
  33  | type SeedDatabase = ReturnType<typeof makeDatabase>
  34  | 
  35  | function makeDatabase() {
  36  |   const pool = new Pool({ ...getDatabasePoolConfig(), max: 1 })
  37  | 
  38  |   return {
  39  |     pool,
  40  |     db: drizzle(pool),
  41  |   }
  42  | }
  43  | 
  44  | function slugify(value: string) {
  45  |   return value
  46  |     .trim()
  47  |     .toLowerCase()
  48  |     .normalize('NFD')
  49  |     .replace(/[\u0300-\u036f]/g, '')
  50  |     .replace(/[^a-z0-9]+/g, '-')
  51  |     .replace(/^-+|-+$/g, '')
  52  | }
  53  | 
  54  | export function canRunCategorySettingsFlow() {
  55  |   return Boolean(process.env.DATABASE_URL && process.env.STAGING_KEY)
  56  | }
  57  | 
  58  | export function categorySettingsSkipReason() {
  59  |   const missing = [
  60  |     !process.env.DATABASE_URL && 'DATABASE_URL',
  61  |     !process.env.STAGING_KEY && 'STAGING_KEY',
  62  |   ].filter(Boolean)
  63  | 
  64  |   return `Skipping /settings/categories browser flow: missing ${missing.join(', ')}.`
  65  | }
  66  | 
  67  | export function makeCategorySettingsSeed(): CategorySettingsSeed {
  68  |   const runId = Date.now().toString(36)
  69  |   const prefix = `S03 ${runId}`
  70  | 
  71  |   return {
  72  |     userId: process.env.STAGING_USER_ID ?? 'staging-user',
  73  |     runId,
  74  |     prefix,
  75  |     createdCategoryName: `${prefix} creata`,
  76  |     createdCategoryRenamedName: `${prefix} categoria rinominata`,
  77  |     createdSubcategoryName: `${prefix} sottocategoria creata`,
  78  |     createdSubcategoryRenamedName: `${prefix} sottocategoria rinominata`,
  79  |     linkedCategoryName: `${prefix} categoria collegata`,
  80  |     linkedSubcategoryName: `${prefix} sottocategoria collegata`,
  81  |     unlinkedCategoryName: `${prefix} categoria eliminabile`,
  82  |     unlinkedSubcategoryName: `${prefix} sottocategoria eliminabile`,
  83  |     systemSubcategoryOriginalName: '',
  84  |     systemSubcategoryOverrideName: `${prefix} sistema personalizzato`,
  85  |     pattern: `s03-${runId}-negozio`,
  86  |     patternDescription: `${prefix} pattern`,
  87  |   }
  88  | }
  89  | 
  90  | async function syncSerialSequences(database: SeedDatabase) {
  91  |   await database.db.execute(sql`select setval(pg_get_serial_sequence('category', 'id'), coalesce((select max(id) from category), 0) + 1, false)`)
  92  |   await database.db.execute(sql`select setval(pg_get_serial_sequence('sub_category', 'id'), coalesce((select max(id) from sub_category), 0) + 1, false)`)
  93  |   await database.db.execute(sql`select setval(pg_get_serial_sequence('categorization_pattern', 'id'), coalesce((select max(id) from categorization_pattern), 0) + 1, false)`)
  94  | }
  95  | 
  96  | async function cleanupRows(database: SeedDatabase, seed: Pick<CategorySettingsSeed, 'userId' | 'prefix' | 'pattern'>) {
  97  |   const namePattern = `${seed.prefix}%`
  98  |   const patternPattern = `s03-%`
  99  | 
> 100 |   await database.db
      |   ^ Error: Failed query: delete from "categorization_pattern" where ("categorization_pattern"."user_id" = $1 and ("categorization_pattern"."pattern" like $2 or "categorization_pattern"."description" like $3))
  101 |     .delete(categorizationPattern)
  102 |     .where(
  103 |       and(
  104 |         eq(categorizationPattern.userId, seed.userId),
  105 |         or(like(categorizationPattern.pattern, patternPattern), like(categorizationPattern.description, namePattern)),
  106 |       ),
  107 |     )
  108 | 
  109 |   await database.db
  110 |     .delete(userSubcategoryOverride)
  111 |     .where(
  112 |       and(
  113 |         eq(userSubcategoryOverride.userId, seed.userId),
  114 |         like(userSubcategoryOverride.customName, namePattern),
  115 |       ),
  116 |     )
  117 | 
  118 |   await database.db
  119 |     .delete(expense)
  120 |     .where(and(eq(expense.userId, seed.userId), like(expense.title, namePattern)))
  121 | 
  122 |   await database.db
  123 |     .delete(subCategory)
  124 |     .where(and(eq(subCategory.userId, seed.userId), like(subCategory.name, namePattern)))
  125 | 
  126 |   await database.db
  127 |     .delete(category)
  128 |     .where(and(eq(category.userId, seed.userId), like(category.name, namePattern)))
  129 | }
  130 | 
  131 | export async function prepareCategorySettingsSeed(seed: CategorySettingsSeed) {
  132 |   const database = makeDatabase()
  133 | 
  134 |   try {
  135 |     await cleanupRows(database, seed)
  136 |     await syncSerialSequences(database)
  137 | 
  138 |     await database.db
  139 |       .insert(user)
  140 |       .values({
  141 |         id: seed.userId,
  142 |         name: 'Staging User',
  143 |         email: `${seed.userId}@example.local`,
  144 |         emailVerified: true,
  145 |         subscriptionPlan: 'basic',
  146 |         role: 'user',
  147 |       })
  148 |       .onConflictDoUpdate({
  149 |         target: user.id,
  150 |         set: { subscriptionPlan: 'basic', role: 'user' },
  151 |       })
  152 | 
  153 |     const [systemTarget] = await database.db
  154 |       .select({ id: subCategory.id, name: subCategory.name })
  155 |       .from(subCategory)
  156 |       .innerJoin(category, eq(category.id, subCategory.categoryId))
  157 |       .where(
  158 |         and(
  159 |           isNull(subCategory.userId),
  160 |           eq(subCategory.isActive, true),
  161 |           eq(category.isActive, true),
  162 |         ),
  163 |       )
  164 |       .limit(1)
  165 | 
  166 |     if (!systemTarget) {
  167 |       throw new Error('No active system subcategory found for personal override test.')
  168 |     }
  169 | 
  170 |     seed.systemSubcategoryOriginalName = systemTarget.name
  171 | 
  172 |     const [linkedCategory] = await database.db
  173 |       .insert(category)
  174 |       .values({
  175 |         userId: seed.userId,
  176 |         name: seed.linkedCategoryName,
  177 |         slug: slugify(seed.linkedCategoryName),
  178 |         type: 'out',
  179 |         isActive: true,
  180 |       })
  181 |       .returning({ id: category.id })
  182 | 
  183 |     const [linkedSubcategory] = await database.db
  184 |       .insert(subCategory)
  185 |       .values({
  186 |         userId: seed.userId,
  187 |         categoryId: linkedCategory.id,
  188 |         name: seed.linkedSubcategoryName,
  189 |         slug: slugify(seed.linkedSubcategoryName),
  190 |         isActive: true,
  191 |       })
  192 |       .returning({ id: subCategory.id })
  193 | 
  194 |     const [unlinkedCategory] = await database.db
  195 |       .insert(category)
  196 |       .values({
  197 |         userId: seed.userId,
  198 |         name: seed.unlinkedCategoryName,
  199 |         slug: slugify(seed.unlinkedCategoryName),
  200 |         type: 'out',
```