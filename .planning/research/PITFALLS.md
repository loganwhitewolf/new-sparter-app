# Domain Pitfalls — Sparter

**Domain:** Personal finance web app (Next.js 15 + Drizzle + MySQL + NextAuth v5)
**Researched:** 2026-04-22
**Confidence note:** External tool access (WebSearch, WebFetch, Context7) was unavailable during this research session. All findings are drawn from training knowledge of the listed technologies (cutoff August 2025). Confidence levels reflect how stable/well-documented each pitfall is. Flag for re-verification against current official docs where noted.

---

## Severity Tiers

| Tier | Meaning |
|------|---------|
| CRITICAL | Causes silent data corruption, security holes, or complete rewrites |
| HIGH | Causes hard-to-debug runtime failures or blocked features |
| MODERATE | Causes degraded UX, wasted dev time, or tech debt |
| LOW | Causes friction, minor bugs, or future pain |

---

## CRITICAL Pitfalls

---

### C-1: Drizzle Returns DECIMAL Columns as Strings — Decimal.js Breaks Silently

**Severity:** CRITICAL
**Affects phases:** 3 (Expense management), 4 (Dashboard KPI), 5 (Import)

**What goes wrong:**
Drizzle ORM maps MySQL `DECIMAL(10,2)` columns to TypeScript `string`, not `number`. When you pass a raw value from a Drizzle query result to `new Decimal(value)`, it works — Decimal.js accepts strings. The trap is the reverse path: when you call `toNumber()` or `parseFloat(d.toFixed(2))` on a Decimal result and then store it back, Drizzle's insert/update expects either a string (`"12.50"`) or a number. If you pass a JS `number` with floating-point representation (`12.499999999`) through an intermediate calculation, the ORM silently inserts the wrong value.

The second trap: Drizzle `decimal` column type does NOT validate precision client-side. You can insert `"1234567890.99"` (10 digits + 2 decimals = DECIMAL(10,2) overflow) and MySQL will silently truncate it — no Drizzle-level error.

**Warning signs:**
- Amount totals are slightly off in the dashboard (off-by-one-cent errors)
- `confidenceScore` (DECIMAL(3,2)) stored as `1` instead of `1.00`
- TypeScript shows `amount: string` in query results but code uses `amount` arithmetically without conversion
- eslint/TS does not catch `"10.50" + "5.25"` = `"10.505.25"` (string concatenation instead of addition)

**Prevention:**
1. In Drizzle schema, declare decimal columns explicitly: `decimal('amount', { precision: 10, scale: 2 })`. Do not use `real` or `float`.
2. Create a project-wide util `toDecimal(v: string | number): Decimal` that normalizes both types.
3. Create a util `toDbDecimal(d: Decimal): string` that calls `d.toFixed(2)` — always pass strings to Drizzle inserts for decimal columns.
4. Write a unit test for the round-trip: DB read → Decimal calculation → DB write → DB read again → compare.
5. Lint rule: forbid raw `+`, `-`, `*`, `/` on any variable named `amount`, `balance`, `total`, `score`.

**Phase guidance:** Establish `toDecimal` / `toDbDecimal` utils in Phase 3 (first time amounts are written). Do NOT wait until the import pipeline (Phase 5).

---

### C-2: Import Pipeline Atomicity — Transaction Wraps Files + Transactions + Expenses or None

**Severity:** CRITICAL
**Affects phases:** 5 (Import), 6 (Import avanzato)

**What goes wrong:**
The import pipeline in `importFile()` does multi-table writes: creates/updates `Files`, creates `Transactions`, upserts `Expenses`, and runs the categorization pipeline. If any step throws (e.g., a `transactionHash` unique constraint violation on row 47 of 200), and the prior 46 rows were already committed in separate `db.insert()` calls, you get a half-imported file. The `Files` record shows `status=processing` forever. Re-importing causes `transactionHash` dedup to skip the already-committed rows while re-processing the rest, resulting in inconsistent state.

Drizzle supports transactions via `db.transaction(async (tx) => { ... })`. The trap: Drizzle transactions pass a `tx` object that must be used for all queries inside the transaction. If any nested helper function uses the module-level `db` import instead of `tx`, those writes escape the transaction boundary and are committed even if the outer transaction rolls back.

**Warning signs:**
- Files stuck in `status=processing` after failed imports
- `expenses` table has rows without any linked `transactions`
- Partial imports where row counts don't match file row counts
- Helper functions with signature `fn(db: typeof db)` instead of `fn(tx: DrizzleTransaction)`

**Prevention:**
1. Wrap the entire `importFile()` body in a single `db.transaction(async (tx) => { ... })`.
2. Define a TypeScript type alias: `type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]`. All data-access helpers accept `DbOrTx` instead of `typeof db`.
3. Pass `tx` explicitly through the call stack: `importRow(tx, row)`, `findOrCreateExpense(tx, hash)`, `runCategorizationPipeline(tx, expense)`.
4. After any failed import in dev, verify `files`, `transactions`, and `expenses` tables are all clean (no orphaned rows).
5. Add an integration test that throws after row 5 of 10 and asserts all tables are empty post-rollback.

**Phase guidance:** Design the `DbOrTx` type and `db.transaction` wrapper in Phase 5 before writing any import logic. Do not retrofit transactions onto existing helpers.

---

### C-3: NextAuth v5 — Custom Session Fields Not Persisted Without Explicit Callbacks

**Severity:** CRITICAL
**Affects phases:** 2 (Auth), 3+ (any server component that reads session)

**What goes wrong:**
NextAuth v5 breaks from v4. The `session` callback and `jwt` callback must explicitly forward custom fields or they are silently dropped. Fields like `subscriptionPlan`, `role`, `userId`, `status`, and `memberSince` that exist on the `User` DB record will NOT appear on `session.user` unless you:
1. Add them to the `jwt` callback (persists them into the JWT token)
2. Add them to the `session` callback (exposes them from the token to `session.user`)
3. Extend the `Session` and `JWT` TypeScript interfaces via module augmentation

The v5 trap specific to Credentials provider: the `authorize()` function's return value is the only moment you can inject custom fields into the JWT. If you return `{ id, email }` from `authorize()`, that is all that ever enters the token. Returning `{ id, email, subscriptionPlan, role }` requires the `jwt` callback to forward those fields or they are still dropped at the next token rotation.

**Warning signs:**
- `session.user.subscriptionPlan` is `undefined` in server components
- Feature gates (free/basic/pro) silently fail open or closed
- `auth()` returns a session object that only has `name`, `email`, `image`
- TypeScript doesn't warn because `session.user` is typed as `{ name?, email?, image? }` without augmentation

**Prevention:**
1. In `auth.config.ts`, implement both `jwt` and `session` callbacks from day one:
   ```ts
   callbacks: {
     jwt({ token, user }) {
       if (user) {
         token.id = user.id
         token.role = user.role
         token.subscriptionPlan = user.subscriptionPlan
         token.status = user.status
       }
       return token
     },
     session({ session, token }) {
       session.user.id = token.id as string
       session.user.role = token.role as string
       session.user.subscriptionPlan = token.subscriptionPlan as string
       session.user.status = token.status as string
       return session
     }
   }
   ```
2. Add module augmentation in `types/next-auth.d.ts`:
   ```ts
   declare module "next-auth" {
     interface Session {
       user: { id: string; role?: string; subscriptionPlan: string; status: string } & DefaultSession["user"]
     }
     interface JWT { id: string; role?: string; subscriptionPlan: string; status: string }
   }
   ```
3. Write an integration test that logs in and asserts `session.user.subscriptionPlan` is not undefined.

**Phase guidance:** Phase 2 (Auth). Must be complete before Phase 3 touches any feature-gated code. The staging bypass middleware also needs to inject a fake session with all fields populated.

---

## HIGH Pitfalls

---

### H-1: drizzle-kit Migrations — Schema Drift and Destructive Changes

**Severity:** HIGH
**Affects phases:** All (schema changes across every phase)

**What goes wrong:**
`drizzle-kit generate` creates migration SQL files by diffing the current schema against the last snapshot. Common traps:

1. **Renaming a column** is detected as `DROP COLUMN` + `ADD COLUMN`, not `RENAME COLUMN`. Running the migration against production silently drops data.
2. **Changing a column type** (e.g., `varchar(255)` to `text`) generates an `ALTER TABLE MODIFY COLUMN` that on MySQL can lock the table for a full copy on large tables.
3. **Adding a NOT NULL column without a default** to a table with existing rows causes the migration to fail on MySQL in strict mode — but only in production (dev DB is usually empty).
4. **Multiple developers** running `drizzle-kit generate` against the same branch creates conflicting migration files that reference the same base snapshot. The first `drizzle-kit migrate` to run wins; the second breaks.
5. **`drizzle-kit push`** (used in development) does not create migration files. If push was used in dev and `generate` is run later, the diff can be empty or wrong depending on what's in the snapshots directory.

**Warning signs:**
- `migrations/` directory has files with the same timestamp prefix
- `_journal.json` shows gaps or conflicts
- CI migration step passes but column data is gone in staging
- A column appears in `schema.ts` but not in the actual DB (push was used, generate was not)

**Prevention:**
1. Never use `drizzle-kit push` outside of local-only throw-away development. Use `drizzle-kit generate` + `drizzle-kit migrate` consistently.
2. Before running any migration, always read the generated SQL file — treat it like a code review. CI should print the SQL diff to the PR.
3. For renames: use a two-step migration — add new column, backfill, drop old column (three separate PRs/migrations for safety).
4. Add NOT NULL columns with a DEFAULT first, then remove the default in a follow-up migration once the column is populated.
5. Store `drizzle/` (migrations + snapshots) in git. Never `.gitignore` the snapshots.

**Phase guidance:** Establish the migration workflow in Phase 2 (first schema). Enforce it as a team norm before Phase 3 adds significant schema complexity.

---

### H-2: Next.js App Router — Server Actions for File Upload Are Wrong

**Severity:** HIGH
**Affects phases:** 5 (Import file bancari)

**What goes wrong:**
Next.js Server Actions have a default body size limit of **1 MB** (configurable, but not designed for large file uploads). The temptation is to use a `<form action={serverAction}>` with `<input type="file">` to upload a CSV directly through a Server Action. This breaks for files over 1 MB and silently fails or throws a cryptic error.

The correct pattern for file uploads in Next.js 15 is a **Route Handler** (`app/api/upload/route.ts`) that accepts `multipart/form-data`, streams the file to R2, and returns a file ID. Server Actions are for form mutations on small data only.

Second trap: Next.js 15 Route Handlers also have a default body size limit (`bodyParser` equivalent). The default is 4 MB. For large Excel files (some Italian bank exports can be 5–20 MB), this requires explicit configuration.

**Warning signs:**
- Upload works in dev with small test files but fails in staging with real bank exports
- The error message is `PayloadTooLargeError` or the request just hangs
- Using `const formData = await request.formData()` buffers the entire file in memory before streaming to R2

**Prevention:**
1. Use a Route Handler (`POST /api/files/upload`) for all file uploads, not a Server Action.
2. Set `export const config = { api: { bodyParser: false } }` in the route (or use `request.body` as a stream directly).
3. For R2 upload, use the `PutObjectCommand` with a `Body: readableStream` — stream directly, do not buffer in memory.
4. Set `maxDuration = 60` on the upload route (Vercel/Railway timeout). Railway default is 30s, which is tight for large files on slow connections.
5. Client-side: enforce a file size limit in the `<input>` onChange handler before the upload starts (e.g., 20 MB max) with a user-friendly Italian error message.

**Phase guidance:** Phase 5. Design the upload route as a streaming Route Handler from the start — do not prototype with Server Actions and refactor later.

---

### H-3: Next.js App Router — `revalidatePath` After Mutations Doesn't Reach Cached Layouts

**Severity:** HIGH
**Affects phases:** 3 (Expense management), 4 (Dashboard KPI), 5 (Import)

**What goes wrong:**
In Next.js App Router, `revalidatePath('/dashboard')` only revalidates the page segment that matches the path. If the dashboard layout (`layout.tsx`) fetches data (e.g., unread notification count, subscription plan for the nav), it is cached separately and `revalidatePath('/dashboard')` will NOT invalidate it unless you also call `revalidatePath('/dashboard', 'layout')`.

Second trap: Server Actions trigger `revalidatePath` on the server, but the client receives a new RSC payload only for the segments that were invalidated. If the action is called from a deeply nested client component, the revalidation might not re-render the parent segment that shows the updated data. The user sees stale data until they hard-refresh.

Third trap: calling `revalidatePath` inside a `try/catch` block that swallows errors means if the mutation failed, the cache is still invalidated — the UI refreshes to show the same (unchanged) data, confusing the user.

**Warning signs:**
- Dashboard totals don't update immediately after importing a file
- Uncategorized count in the nav stays at the old value after categorizing an expense
- `revalidatePath` is called but the page shows stale data

**Prevention:**
1. Use `revalidatePath('/dashboard', 'layout')` for any mutation that affects layout-level data.
2. Prefer `revalidateTag` with named tags over path-based revalidation for fine-grained control:
   ```ts
   // In data fetch:
   fetch(..., { next: { tags: ['expenses', `expenses-${userId}`] } })
   // In server action after mutation:
   revalidateTag(`expenses-${userId}`)
   ```
3. Only call `revalidatePath`/`revalidateTag` after confirming the mutation succeeded (outside the `catch` block, after `await`).
4. For the import pipeline (Phase 5), call `revalidateTag` for both `transactions` and `expenses` after a successful import.

**Phase guidance:** Phase 3. Establish the revalidation pattern on the first mutation (create/update Expense). Retrofitting is painful because every Server Action needs updating.

---

### H-4: Decimal.js JSON Serialization — Decimal Objects Don't Serialize

**Severity:** HIGH
**Affects phases:** 4 (Dashboard KPI), 3 (Expense management)

**What goes wrong:**
`new Decimal("12.50")` creates a Decimal object. When you try to serialize it with `JSON.stringify` (e.g., returning it from a Server Action, passing it as a prop, or logging it), the output is `{}` — the Decimal object serializes to an empty object because Decimal.js does not implement `toJSON()`.

This means: if a Server Action returns `{ totalOut: new Decimal("150.00") }`, the client receives `{ totalOut: {} }`. No error is thrown. The bug is completely silent.

Second trap: Next.js App Router automatically serializes Server Action return values with `JSON.stringify`. Returning Decimal objects from Server Actions is therefore always wrong.

**Warning signs:**
- Dashboard KPI values are `{}` or `0` on the client
- `JSON.stringify(new Decimal("1.5"))` returns `"{}"` in the console
- React "Objects are not valid as a React child" error when rendering an amount

**Prevention:**
1. Server Actions and API routes MUST serialize amounts before returning:
   ```ts
   return {
     totalOut: new Decimal(row.totalOut).toFixed(2),     // string "150.00"
     savingsRate: new Decimal(row.savingsRate).toNumber() // number 0.12
   }
   ```
2. Define a clear contract: amounts returned to the client are always `string` (using `toFixed(2)`). Client components never do Decimal arithmetic — they format strings for display.
3. Create a `formatCurrency(value: string): string` util that does `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(parseFloat(value))`. This is the only place `parseFloat` is acceptable.
4. Lint rule: no `Decimal` type in any `return` statement of a Server Action or Route Handler.

**Phase guidance:** Phase 3 (first Server Action that returns amounts). The `formatCurrency` util should be written in Phase 1 (design system) to be available everywhere.

---

### H-5: NextAuth v5 — `auth()` vs `getServerSession()` API Change

**Severity:** HIGH
**Affects phases:** 2 (Auth), all subsequent phases

**What goes wrong:**
NextAuth v5 replaces `getServerSession(authOptions)` (v4 pattern) with `auth()` (v5 pattern). The v5 `auth()` function is exported directly from your `auth.ts` config file and works in Server Components, Route Handlers, Server Actions, and Middleware.

Traps:
1. **Mixing v4 and v5 imports**: Copy-pasted code from Stack Overflow, blog posts, or the LLM's training data often uses `getServerSession`. This compiles fine (the import resolves) but returns `null` in v5 because the internals changed. The bug is silent — auth check passes as `session == null` → unauthenticated, redirect loop or unprotected route.
2. **Middleware gotcha**: In Next.js 15 Middleware, `auth()` must be called as a middleware wrapper (`export default auth(middleware)`), not as `const session = await auth()`. Calling `auth()` directly in middleware body works but requires the full JWT decode on every request, which has performance implications.
3. **Edge runtime**: NextAuth v5 JWT session works in Edge runtime. Drizzle + MySQL does NOT. If Middleware uses auth and also tries to query the DB, it will fail in Edge. Keep middleware auth-only (JWT decode), never DB queries.

**Warning signs:**
- `getServerSession` appears anywhere in the codebase (wrong v5 pattern)
- Session is `null` in a protected route handler despite being logged in
- `TypeError: cannot read properties of null (reading 'user')` in server components
- DB queries inside `middleware.ts`

**Prevention:**
1. Single source of truth: `auth()` is imported from `@/auth` (your config file) everywhere. Zero imports of `getServerSession`.
2. Protect routes in middleware via JWT check only. Never query DB in middleware.
3. For DB-dependent auth checks (e.g., check if user is suspended), do them in the Server Component or Server Action, after the session is verified.
4. Document the pattern in a `docs/auth-patterns.md` that all phase agents reference.

**Phase guidance:** Phase 2. Establish the pattern once, enforce via ESLint no-restricted-imports rule against `getServerSession`.

---

## MODERATE Pitfalls

---

### M-1: CSV Encoding — Italian Banks Often Export ISO-8859-1 (Latin-1)

**Severity:** MODERATE
**Affects phases:** 5 (Import), 6 (Import avanzato)

**What goes wrong:**
Intesa Sanpaolo and other Italian banks export CSV files encoded in ISO-8859-1 (Latin-1), not UTF-8. Node.js `fs.readFile` and the browser `FileReader` default to UTF-8. When you parse an ISO-8859-1 file as UTF-8:
- Italian characters (`à`, `è`, `ì`, `ò`, `ù`, `é`) become garbled (`Ã `, `Ã¨`, etc.)
- Description normalization and deduplication (`descriptionHash`) produces wrong hashes — the same expense appears twice with different garbled descriptions
- Regex patterns that match Italian description strings silently fail to match

Fineco exports use UTF-8 with BOM (`\xEF\xBB\xBF` prefix). Parsing without stripping the BOM corrupts the first column header, causing the column mapping to fail silently.

**Warning signs:**
- Description field contains `Ã ` instead of `à`
- First column header appears as `ï»¿Data` instead of `Data`
- Same expense creates two `Expense` records with different garbled `descriptionHash` values
- Categorization regex patterns never match despite correct-looking patterns

**Prevention:**
1. After downloading from R2, detect encoding using the `chardet` or `jschardet` library (detect from byte inspection, not extension).
2. Normalize to UTF-8 before parsing: `iconv-lite` library converts `iconv.decode(buffer, 'ISO-8859-1')`.
3. Strip UTF-8 BOM if present: `buffer.toString('utf8').replace(/^﻿/, '')`.
4. Test with real exports from each supported platform. Store test fixture files in `tests/fixtures/` with the actual encoding.

**Phase guidance:** Phase 5. Must be handled before any real-world testing with Italian bank exports. The `analyzeFile()` function (step 2 of the import flow) is the correct place for encoding detection.

---

### M-2: xlsx Library — Large Excel Files and Memory/Timeout Issues

**Severity:** MODERATE
**Affects phases:** 5 (Import), 6 (Import avanzato)

**What goes wrong:**
The `xlsx` (SheetJS) library by default reads the entire Excel file into memory as a JS object. For large Excel exports (Italian banks sometimes export 2–3 years of history in a single `.xlsx` file — thousands of rows), this can:
1. Consume 200–500 MB of RAM for a 10 MB file (in-memory DOM representation is much larger than the file)
2. Cause the Next.js Route Handler to time out on Railway (30s default) for files over 5,000 rows
3. Block the Node.js event loop during parsing (xlsx is synchronous by default)

Second trap: SheetJS Community Edition (`xlsx` package on npm) has had security advisories. The Pro version (`xlsx-js-style`) is a fork. Check current advisories before choosing.

**Warning signs:**
- Import of large files fails with no error (timeout, not an exception)
- Memory usage spikes dramatically during import
- Small test files work; real bank exports don't

**Prevention:**
1. Use `xlsx` in streaming mode where possible: `XLSX.stream.to_json(ws)` instead of `XLSX.utils.sheet_to_json(ws)`.
2. Set `dense: true` option in `XLSX.read()` to reduce memory footprint.
3. Cap file size at upload time (client-side and server-side) to a reasonable limit (e.g., 10 MB).
4. For the Route Handler, set `maxDuration = 60` (or 120 if Railway plan allows).
5. Consider processing Excel files asynchronously: upload → save to R2 → return fileId → poll status. This matches the existing `status: pending | processing | done | error` design on `Files`.

**Phase guidance:** Phase 5. Test with real Italian bank exports of 12+ months of data before marking the import feature complete.

---

### M-3: Drizzle NULL Handling — Nullable Columns vs Undefined in TypeScript

**Severity:** MODERATE
**Affects phases:** 3 (Expense management), 5 (Import)

**What goes wrong:**
Drizzle maps nullable DB columns to `T | null` in TypeScript (correct). However, when building insert/update objects, TypeScript allows passing `undefined` for optional keys but Drizzle will throw at runtime if a non-nullable column receives `undefined`. The distinction between `null` (explicit DB null) and `undefined` (key omitted from object) is invisible in some code patterns.

Specific trap: `expenseId` on `Transactions` is nullable (a transaction may not yet be linked to an expense). If you accidentally pass `expenseId: undefined` instead of `expenseId: null` when creating a transaction without an expense, Drizzle may throw or insert `NULL` depending on the MySQL driver version — inconsistent behavior.

**Warning signs:**
- Runtime error `ER_BAD_NULL_ERROR` on insert despite TypeScript showing no error
- Some columns are `NULL` in the DB when they should have values
- `transaction.expenseId` is sometimes `undefined` and sometimes `null` causing `=== null` checks to fail

**Prevention:**
1. Always be explicit: use `null` for intentional DB nulls, never `undefined` in insert/update objects.
2. Enable TypeScript strict mode — `"strict": true` in `tsconfig.json`. This makes `undefined` vs `null` errors visible at compile time.
3. In Drizzle schema, always specify `.notNull()` for required columns and `.$defaultFn(...)` for computed defaults, so omitting a field is a TS compile error not a runtime error.
4. Use Zod to validate all input before DB inserts (you already use Zod — port validators from Express).

**Phase guidance:** Phase 3 (first schema with nullable FKs). Establish the `null` vs `undefined` convention before Phase 5 adds the complex multi-table insert.

---

### M-4: "use client" Boundary — Server Components That Fetch Data Must Not Import Client Components That Import Server-Only Code

**Severity:** MODERATE
**Affects phases:** 3 (Expense management), 4 (Dashboard KPI)

**What goes wrong:**
The most common Next.js App Router mistake: a Server Component directly imports a Client Component (`"use client"`) that imports `drizzle/db` or `auth` (server-only code). This throws a build error: `You're importing a component that needs 'server-only' but it's being used as a client component.`

Inverse trap: a Client Component is placed in a file without `"use client"` directive, and it works in dev but fails in production with hydration errors because Next.js treats it as a Server Component that renders interactive hooks.

The dashboard page has complex requirements: Server Components for initial data fetch, Client Components for interactive charts and filters. Getting the boundary wrong means either the chart can't be interactive or the DB fetch happens on the client (bad).

**Warning signs:**
- `Error: You're importing a component that needs 'server-only'`
- Hydration mismatch errors in production but not dev
- `useState`/`useEffect` inside a file without `"use client"` directive
- DB queries firing from the browser (visible in network tab)

**Prevention:**
1. Architecture rule: Data fetching (Drizzle queries) happens ONLY in `page.tsx`, `layout.tsx`, or dedicated Server Action files. Never inside component files.
2. Pass data as props from Server Components down to Client Components. Client Components receive serialized data (plain objects/arrays), never Drizzle result objects directly.
3. Create a `components/server/` and `components/client/` directory split to make boundaries explicit.
4. Install `server-only` package and import it at the top of all DB query files — this throws a build error immediately if imported from a client context.

**Phase guidance:** Phase 1 (component architecture setup). Establish the directory structure and `server-only` guard before any data-fetching components are built.

---

### M-5: Cloudflare R2 CORS Configuration for Browser Uploads

**Severity:** MODERATE
**Affects phases:** 5 (Import file bancari)

**What goes wrong:**
If the upload goes through the Next.js Route Handler (browser → Next.js → R2), CORS on R2 doesn't matter. But if you switch to presigned URL uploads (browser uploads directly to R2 to skip server bandwidth), R2 CORS must be configured explicitly — R2 buckets have no CORS rules by default, and the browser will silently fail the upload with a CORS error, showing no useful message to the user.

R2 presigned URL gotcha: `PutObjectCommand` presigned URLs are valid for a maximum of 7 days, but R2's implementation has a practical limit of 1 hour for browser uploads (the bucket must be configured to accept the token). If the user opens the upload dialog and leaves it open for more than the presigned URL's expiry, the upload silently fails.

**Warning signs:**
- Upload works in Postman but fails in the browser
- Network tab shows `403 Forbidden` or CORS error on the R2 endpoint
- Upload fails for users who keep the tab open a long time

**Prevention:**
1. For Phase 5, use server-side upload (browser → Next.js Route Handler → R2). Simpler, no CORS needed.
2. If switching to presigned URLs later, configure R2 CORS rules via the Cloudflare dashboard:
   ```json
   [{"AllowedOrigins": ["https://yourdomain.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000}]
   ```
3. Set presigned URL expiry to 15 minutes (not the max) and handle expiry gracefully on the client (retry with a new presigned URL).
4. Test uploads from the actual production domain, not `localhost` — CORS rules differ.

**Phase guidance:** Phase 5. If using direct browser-to-R2 upload, configure CORS before any integration testing.

---

### M-6: `transactionHash` Dedup — MD5 Collision Risk and Hash Stability

**Severity:** MODERATE
**Affects phases:** 5 (Import), 6 (Import avanzato)

**What goes wrong:**
The `transactionHash` is `MD5(amount + description + timestamp)`. Edge cases:

1. **Italian banks format dates inconsistently**: Intesa exports `25/03/2024`, Revolut exports `2024-03-25`. If the timestamp is not normalized to a canonical format before hashing, the same transaction imported from two different exports of the same account creates two records.
2. **Amount format inconsistencies**: Intesa uses comma as decimal separator (`-12,50`), some exports use period. If the amount is not normalized before hashing, the same transaction hashes differently.
3. **Description whitespace**: some banks pad descriptions with trailing spaces or include varying amounts of internal whitespace. `"NETFLIX  "` and `"NETFLIX"` hash differently.
4. **MD5 is not cryptographically strong** but that's acceptable here — it's a dedup key, not a security primitive. Document this explicitly to avoid future confusion.

**Warning signs:**
- Same transaction appears twice after importing the same file twice (dedup not working)
- Same transaction appears twice after importing overlapping date-range exports
- `transactionHash` unique constraint violation when the same transaction has always existed (hash changed due to normalization bug)

**Prevention:**
1. Normalize ALL inputs before hashing: amount → `new Decimal(rawAmount).toFixed(2)`, timestamp → ISO 8601 date string `YYYY-MM-DD`, description → `.trim().replace(/\s+/g, ' ')`.
2. Write a dedicated `computeTransactionHash(amount, description, timestamp): string` function with unit tests covering Italian date/amount formats.
3. Include the `platformId` in the hash if two platforms could represent the same transaction differently (e.g., both show the same Netflix charge but with different description formatting).

**Phase guidance:** Phase 5, before the first real import test. The hash function must be locked before any data is stored — changing it later requires re-hashing all existing transactions.

---

## LOW Pitfalls

---

### L-1: drizzle-kit — Snapshot Files Must Be in Git

**Severity:** LOW
**Affects phases:** All

**What goes wrong:**
`drizzle-kit generate` stores schema snapshots in `drizzle/meta/`. If these are `.gitignore`d (a common mistake when adding `drizzle/` to gitignore), the next developer who runs `generate` gets a diff against an empty schema and generates a migration that tries to CREATE all tables — even if they already exist in the database. Running that migration destroys existing data.

**Prevention:**
Explicitly add only `drizzle/meta/` to git. Never gitignore the entire `drizzle/` directory. Add a CI check that confirms snapshot files are committed.

**Phase guidance:** Phase 2 (initial schema setup). Add to `.gitignore` and `.gitkeep` rules at project initialization.

---

### L-2: Next.js 15 — Async Params in `page.tsx`

**Severity:** LOW
**Affects phases:** 3 (Expense management), all detail pages

**What goes wrong:**
Next.js 15 changed `params` and `searchParams` in `page.tsx` to be Promises. Code written for Next.js 14 uses `params.id` synchronously. In Next.js 15, `params.id` is `undefined` until you `await params`. This is a TypeScript-visible change but easy to miss if using older docs.

```ts
// Wrong (Next.js 14 pattern):
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>
}

// Correct (Next.js 15):
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <div>{id}</div>
}
```

**Prevention:**
Use the Next.js 15 TypeScript types from the start. The compiler will warn if params are not awaited, provided types are correct.

**Phase guidance:** Phase 3 (first dynamic route). Set the pattern once in the first `[id]/page.tsx`.

---

### L-3: Cloudflare R2 — `storageKey` Naming and User Isolation

**Severity:** LOW
**Affects phases:** 5 (Import)

**What goes wrong:**
The business logic specifies `storageKey` format as `uploads/{userId}/{fileId}.{ext}`. If `userId` is a UUID (e.g., `a3f2c1d4-...`) and `fileId` is auto-incremented, then sequential file IDs like `1`, `2`, `3` are predictable. An authenticated user who knows another user's `userId` could construct a valid R2 key and attempt to download their file (if the bucket is accidentally set to public).

**Prevention:**
1. Keep the R2 bucket private (no public access policy). All reads go through signed URLs or server-side proxy.
2. When generating download URLs, always verify `file.userId === session.user.id` before generating a presigned GET URL.
3. Use UUID v4 for `fileId` (random, not sequential) to make keys non-guessable even if the bucket is accidentally opened.

**Phase guidance:** Phase 5. Enforce in the download route handler from day one.

---

### L-4: Decimal.js — `toNumber()` Loses Precision for Very Large Amounts

**Severity:** LOW
**Affects phases:** 4 (Dashboard KPI)

**What goes wrong:**
`new Decimal("9999999.99").toNumber()` returns `9999999.99` correctly. But `new Decimal("99999999999.99").toNumber()` can lose precision because JS `number` is IEEE 754 double-precision. For a personal finance app tracking individual transactions, `DECIMAL(10,2)` (max `99,999,999.99`) is safe. However, if the KPI aggregation sums thousands of transactions, the intermediate total may exceed safe integer range.

**Prevention:**
Never call `.toNumber()` on aggregated totals — keep as Decimal or serialize to string. The `toNumber()` rule from the business logic doc applies to single transaction amounts only.

**Phase guidance:** Phase 4. Ensure KPI aggregation uses Decimal accumulation, not number summation.

---

### L-5: NextAuth v5 — Staging Bypass Middleware Implementation

**Severity:** LOW
**Affects phases:** 2 (Auth)

**What goes wrong:**
The business logic specifies a staging bypass via `x-staging-key` header. In Next.js Middleware, headers from incoming requests are readable via `request.headers.get('x-staging-key')`. The trap: `process.env.NODE_ENV` is `production` on Railway staging environments (Railway uses `production` mode even for non-prod deployments). The bypass check must use a dedicated env var (`STAGING_KEY`) rather than `NODE_ENV`.

Second trap: if the bypass creates a mock session without all custom fields (`subscriptionPlan`, `role`, `status`), feature-gated code that reads `session.user.subscriptionPlan` will hit the undefined bug from C-3.

**Prevention:**
1. Check `process.env.STAGING_KEY` (a secret known only to the staging environment), not `NODE_ENV`.
2. The mock session injected by the bypass must include all fields present in a real session, typed identically.

**Phase guidance:** Phase 2. Test bypass before any feature-gated code is written.

---

## Phase-Specific Warning Matrix

| Phase | Topic | Most Likely Pitfall | Required Mitigation Before Phase Ends |
|-------|-------|---------------------|----------------------------------------|
| 1 – Design system | Component architecture | M-4 (use client boundary) | Establish `components/server/` + `components/client/` split; install `server-only` |
| 2 – Auth | NextAuth v5 session | C-3 (custom fields), H-5 (auth() API) | JWT + session callbacks with all fields; module augmentation; no `getServerSession` |
| 2 – Auth | Staging bypass | L-5 | Use `STAGING_KEY` env var; mock session must match real session shape |
| 2 – Auth | DB migrations | H-1 (drizzle-kit) | Establish `generate` + `migrate` workflow; never use `push` in team/CI |
| 3 – Expense management | Decimal arithmetic | C-1, H-4 | `toDecimal` / `toDbDecimal` utils; Decimal never returned from Server Actions |
| 3 – Expense management | Nullable columns | M-3 | `null` vs `undefined` convention; strict TS; `server-only` guard |
| 3 – Expense management | Cache invalidation | H-3 | `revalidateTag` pattern established on first mutation |
| 4 – Dashboard KPI | Aggregation precision | L-4 | Decimal accumulation for sums; string serialization for API responses |
| 5 – Import | Transaction atomicity | C-2 | `db.transaction(tx => ...)` wrapping full import; `DbOrTx` type for helpers |
| 5 – Import | File upload route | H-2 | Route Handler (not Server Action); streaming to R2 |
| 5 – Import | Encoding detection | M-1 | `chardet` + `iconv-lite`; strip BOM; fixture test files per platform |
| 5 – Import | Hash stability | M-6 | `computeTransactionHash` unit tested; locked before any data is stored |
| 5 – Import | R2 access control | L-3 | Bucket private; userId check before presigned URL |
| 6 – Import avanzato | Excel memory | M-2 | Streaming xlsx parse; file size cap; async processing via file status |

---

## Research Confidence

| Area | Confidence | Basis |
|------|------------|-------|
| Drizzle ORM decimal/transaction/migration behavior | HIGH | Drizzle is well-documented; decimal-as-string is official behavior; transaction `tx` scoping is a known ecosystem pain point |
| Next.js 15 App Router (Server Actions, caching, boundaries) | HIGH | Official Next.js docs and community patterns are stable and well-known |
| NextAuth v5 callback requirements | HIGH | v5 breaking changes are extensively documented; custom field persistence is the most-discussed migration issue |
| Decimal.js JSON serialization | HIGH | `toJSON` absence is a documented property of Decimal.js; reproducible with a one-liner |
| Italian bank CSV encoding | MEDIUM | Based on known Italian bank export behavior patterns; should be verified with real test files from each platform |
| xlsx memory behavior | MEDIUM | Well-known Node.js memory pattern; specific numbers (MB per row) vary by file structure |
| R2 CORS / presigned URL limits | MEDIUM | Based on AWS S3 SDK compatibility; R2-specific edge cases should be verified against Cloudflare R2 docs |

**Note:** WebSearch, WebFetch, and Bash tools were unavailable during this session. Findings marked MEDIUM confidence should be cross-referenced against current official documentation (Drizzle changelog, NextAuth v5 migration guide, Cloudflare R2 CORS docs) during Phase 2 setup.
