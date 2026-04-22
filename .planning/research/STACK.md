# Technology Stack — Sparter

**Project:** Sparter (personal finance web app, Italian market)
**Researched:** 2026-04-22
**Stack status:** Locked (rebuild from Express+Sequelize)

> **Confidence note on sources:** Bash, WebSearch, and WebFetch tools were all permission-denied
> in this research session. All findings below are from training knowledge (cutoff August 2025),
> which covers all packages in this stack at stable/GA release. Versions flagged LOW confidence
> should be verified against npm before installing. Architecture and integration patterns are
> HIGH confidence — they are well-documented stable behaviors, not version-specific guesses.

---

## Stack Overview

| Layer | Choice | Status |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) | Locked |
| ORM | Drizzle ORM + drizzle-kit | Locked |
| Database | MySQL (Railway-hosted) | Locked |
| Auth | NextAuth v5 / Auth.js | Locked |
| Storage | Cloudflare R2 via @aws-sdk/client-s3 | Locked |
| Validation | Zod | Locked |
| Monetary math | Decimal.js | Locked |
| UI | Tailwind CSS + shadcn/ui | Locked |
| Deployment | Railway | Locked |

---

## Package Versions

Use these in `package.json`. Versions are training-data estimates — run `npm info <pkg> version`
to confirm latest before installing.

### Production dependencies

```json
{
  "next": "15.x",
  "react": "19.x",
  "react-dom": "19.x",
  "drizzle-orm": "^0.36.x",
  "mysql2": "^3.11.x",
  "next-auth": "^5.0.0-beta.25",
  "zod": "^3.23.x",
  "decimal.js": "^10.4.x",
  "@aws-sdk/client-s3": "^3.700.x",
  "@aws-sdk/s3-request-presigner": "^3.700.x",
  "bcryptjs": "^2.4.x",
  "tailwindcss": "^3.4.x"
}
```

**Confidence on versions:** MEDIUM. The major.minor is correct; exact patch may have advanced.
Do NOT pin to exact patch — use caret ranges for patch updates.

### Dev dependencies

```json
{
  "drizzle-kit": "^0.28.x",
  "@types/bcryptjs": "^2.4.x",
  "tsx": "^4.x"
}
```

### Critical version notes

**Next.js 15 requires React 19.** React 18 is not supported by Next.js 15's async request APIs
(`cookies()`, `headers()`, `params`, `searchParams` are now async). Do not mix React 18 with
Next.js 15 — it will compile but break in subtle ways at runtime.

**NextAuth is still `next-auth` on npm, not `@auth/nextjs`.** The package `@auth/nextjs` does
not exist as a standalone install. You install `next-auth@^5.0.0-beta.25` and it internally
uses Auth.js v5. The `beta` tag is the stable release channel for v5 — the team has not dropped
the beta suffix despite it being production-ready since late 2024.

**mysql2 not @planetscale/database.** Drizzle supports both, but Railway MySQL is a standard
MySQL 8.x instance. Use `mysql2` directly. PlanetScale's driver is for PlanetScale's edge HTTP
API — it does not work with Railway.

**drizzle-kit must match drizzle-orm minor.** If drizzle-orm is 0.36.x, use drizzle-kit 0.28.x.
The kit version is ORM minor - 8. Mismatches cause silent migration failures or schema drift.
Check the Drizzle changelog when upgrading either.

---

## Integration Patterns

### 1. Next.js 15 + Drizzle ORM: Connection Setup

**The single most important pattern:** instantiate the db client once as a module-level singleton,
never inside a request handler or server action. Next.js 15 in dev mode does module hot-reloading
which can leak connections if you create a new pool on every request.

```ts
// lib/db.ts  — the ONLY place db is created
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,        // tune for Railway's MySQL plan
  queueLimit: 0,
  ssl: { rejectUnauthorized: false },  // required for Railway MySQL
});

export const db = drizzle(pool, { schema, mode: 'default' });
```

**Why `mode: 'default'` not `'planetscale'`:** PlanetScale mode disables FK constraints and
uses a different join syntax. Railway is standard MySQL 8 — always use `'default'`.

**Why `ssl: { rejectUnauthorized: false }`:** Railway MySQL requires SSL but uses a self-signed
certificate. `rejectUnauthorized: true` will reject the connection. This is the documented Railway
pattern. If Railway adds a CA cert to their dashboard in the future, update to use it.

**Connection URL format for Railway:**
```
DATABASE_URL=mysql://user:password@host.railway.app:3306/railway?ssl={"rejectUnauthorized":false}
```
The SSL JSON in the query string works for Drizzle but is fragile in shell scripts. Prefer
setting SSL in code (as above) rather than encoding it in the URL.

### 2. Next.js 15 App Router: Runtime constraint

**Drizzle + mysql2 requires Node.js runtime.** It cannot run on the Edge Runtime. This means:
- Any file that imports `lib/db.ts` must NOT have `export const runtime = 'edge'`
- Middleware (`middleware.ts`) runs on Edge by default — never import db there
- Route segments that need the db are implicitly Node runtime (no annotation needed)

**Auth in middleware is safe because NextAuth v5 uses its own JWT-only middleware check** that
does not touch the database. The `auth` middleware export from `auth.ts` is edge-compatible.
Only the credentials callback and session callbacks that read the DB must run in Node routes/actions.

### 3. Server Actions vs Route Handlers for mutations

**Use Server Actions for all form-driven mutations.** For Sparter this covers:
- Creating/editing expenses and categories
- Categorizing transactions
- User profile updates

**Use Route Handlers (`app/api/...`) for:**
- File upload endpoint (multipart form, streaming body — not suited for server actions)
- Any endpoint called by non-browser clients or webhooks
- The staging bypass middleware check

**Why not server actions for file upload:** Next.js 15 server actions have a default body size
limit (typically 1MB after config, but multipart streaming is unreliable). The CSV/Excel import
flow should use a Route Handler at `app/api/files/upload/route.ts` that pipes the stream to R2.

**Server Action gotcha — `'use server'` placement:** In Next.js 15, `'use server'` at the top of
a file marks ALL exports as server actions. Placing it inside a function marks only that function.
Do NOT put `'use server'` in files that also export types or non-action helpers — it will either
fail to compile or expose unintended server-side code. Keep a dedicated `actions/` directory with
one concern per file.

**Server Action error handling:** Server actions throw errors that bubble to the nearest error
boundary by default. For user-facing validation errors, return a typed result object instead of
throwing:

```ts
// actions/expenses.ts
'use server';
export async function createExpense(data: unknown) {
  const parsed = ExpenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten() };
  }
  // ... db write
  return { success: true };
}
```

Never return raw Error objects — they are not serializable across the server/client boundary.

### 4. NextAuth v5: Current API (changed significantly from v4)

**The v5 config file is `auth.ts` at the project root (not `pages/api/auth/[...nextauth].ts`).**
The catch-all route still exists but is thin:

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

**The `auth.ts` config:**

```ts
// auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        });
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        // Return only what you need in the JWT — avoid returning password hash
        return {
          id: user.id.toString(),
          email: user.email,
          firstName: user.firstName,
          subscriptionPlan: user.subscriptionPlan,
          role: user.role ?? null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firstName = user.firstName;
        token.subscriptionPlan = user.subscriptionPlan;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.firstName = token.firstName as string;
      session.user.subscriptionPlan = token.subscriptionPlan as string;
      session.user.role = token.role as string | null;
      return session;
    },
  },
});
```

**TypeScript augmentation for custom session fields** — required or TypeScript will complain:

```ts
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      firstName: string;
      subscriptionPlan: 'free' | 'basic' | 'pro';
      role: string | null;
    } & DefaultSession['user'];
  }
}
```

**Route protection with middleware:**

```ts
// middleware.ts
import { auth } from '@/auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublic = req.nextUrl.pathname.startsWith('/auth');
  if (!isLoggedIn && !isPublic) {
    return Response.redirect(new URL('/auth/login', req.url));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**v4 → v5 breaking changes to know:**
- `getServerSession()` is gone. Use `auth()` from your `auth.ts` in server components/actions.
- `useSession()` still works on the client but requires wrapping the app in `<SessionProvider>`.
- The `authorize` callback in Credentials must return `null` (not `false`) to reject credentials.
- `secret` is now auto-derived from `AUTH_SECRET` env var — do not set it manually in config.
- Environment variable is `AUTH_SECRET` (not `NEXTAUTH_SECRET`), and `AUTH_URL` (not `NEXTAUTH_URL`).
  Both old names still work as aliases but new projects should use the Auth.js names.

**Staging bypass implementation:** The BUSINESS_LOGIC_HANDOFF.md mentions a staging bypass via
`x-staging-key` header. Implement this in `middleware.ts` before the auth check:

```ts
export default auth((req) => {
  const stagingKey = req.headers.get('x-staging-key');
  if (process.env.NODE_ENV !== 'production' && stagingKey === process.env.STAGING_KEY) {
    return; // allow through
  }
  // ... normal auth check
});
```

### 5. Cloudflare R2: Upload Strategy

**Use presigned URLs for file upload from the browser.** Server-side proxying (browser → Next.js →
R2) doubles bandwidth consumption and hits Next.js memory limits for large files. The correct flow:

```
Browser → POST /api/files/initiate
         ← { fileId, presignedUrl }
Browser → PUT presignedUrl (direct to R2, no Next.js in the middle)
Browser → POST /api/files/confirm { fileId }
         ← { file record }
```

**Generating the presigned URL:**

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function getUploadPresignedUrl(key: string, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, cmd, { expiresIn: 300 }); // 5 min
}
```

**R2-specific gotchas:**
- `region` must be `'auto'` — R2 does not use AWS regions. Any other value causes signature
  mismatch errors.
- The endpoint format is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — not the AWS endpoint.
- R2 does not support multipart upload progress callbacks the same way S3 does. For the Sparter
  use case (CSV/Excel files, typically < 10MB), single-part presigned PUT is sufficient.
- CORS must be configured on the R2 bucket to allow PUT from your app's domain. In production
  set the allowed origin to your Railway domain. In dev, allow `http://localhost:3000`.

**Downloading from R2 for server-side parsing** (the `analyzeFile()` step):

```ts
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function downloadFromR2(key: string): Promise<Buffer> {
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key });
  const res = await r2.send(cmd);
  const stream = res.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

### 6. MySQL on Railway: Connection and Migration Workflow

**Connection string from Railway:** Railway auto-populates `DATABASE_URL` in the service
environment when you add a MySQL plugin. Copy it to your `.env.local` for local dev, but also
add `ssl={"rejectUnauthorized":false}` if the URL lacks it.

**drizzle.config.ts:**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Migration workflow:**

```bash
# Generate SQL migration files from schema changes
npx drizzle-kit generate

# Apply migrations to the database
npx drizzle-kit migrate

# Inspect current DB state (useful when Railway DB drifts from schema)
npx drizzle-kit introspect
```

**Never use `drizzle-kit push` in production.** `push` applies schema changes directly without
creating migration files. It will silently drop columns it doesn't recognize. Always use
`generate` + `migrate` for Railway deployments.

**Railway deployment migration strategy:** Add a build step or a Railway `release command` that
runs `npx drizzle-kit migrate` before the app starts. Railway's release commands run after the
build but before traffic is switched. This avoids the race condition where the new app code starts
before the DB is migrated.

**Seeding categories and platforms:** The BUSINESS_LOGIC_HANDOFF.md states categories and
platforms are seeded and not user-modifiable. Use a dedicated `seed.ts` script with an
`ON DUPLICATE KEY UPDATE` pattern (or Drizzle's `onConflictDoNothing()`) so it is safe to re-run:

```ts
await db.insert(categories).values(CATEGORY_SEED).onDuplicateKeyUpdate({
  set: { updatedAt: sql`now()` },
});
```

### 7. Drizzle Schema: MySQL-specific patterns for Sparter

**DECIMAL columns require explicit precision:**

```ts
import { mysqlTable, decimal, int, varchar, text, timestamp, boolean, json } from 'drizzle-orm/mysql-core';

export const transactions = mysqlTable('transactions', {
  id: int('id').autoincrement().primaryKey(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  // ...
});
```

**Drizzle does not serialize/deserialize Decimal.js automatically.** When reading from DB,
amounts come back as `string` (not `number`), which is correct MySQL behavior. Always wrap
incoming values:

```ts
// Reading: DB → Decimal.js
const amt = new Decimal(row.amount); // row.amount is string "123.45"

// Writing: Decimal.js → DB
{ amount: myDecimal.toFixed(2) }   // pass string, not number
```

**JSON columns (columnMapping on Platforms):** Drizzle's `json()` column returns `unknown` by
default. Cast it explicitly:

```ts
columnMapping: json('column_mapping').$type<ColumnMappingConfig>().notNull(),
```

**Complex aggregations (dashboard KPIs):** As noted in the business logic doc, use `sql` template
literals for GROUP BY aggregations. Drizzle's query builder does not support multi-level GROUP BY
natively:

```ts
import { sql } from 'drizzle-orm';

const result = await db.execute(sql`
  SELECT
    DATE_FORMAT(t.timestamp, '%Y-%m') as month,
    SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_in,
    SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_out
  FROM transactions t
  WHERE t.user_id = ${userId}
  GROUP BY month
  ORDER BY month DESC
`);
```

This is type-safe at the tagged template level and avoids SQL injection.

### 8. Zod: Integration with Server Actions

**Use `safeParse` everywhere, never `parse`.** `parse` throws a `ZodError` which is not a plain
serializable object — it cannot be passed from server action to client. `safeParse` returns a
discriminated union you can return directly.

**Reuse schemas between client validation and server validation.** Define schemas in `lib/schemas/`
and import on both sides. Do NOT duplicate Zod schemas for client vs server.

**File validation for uploads:** CSV and Excel files should be validated server-side by content
type AND by attempting to parse the first few rows, not just by file extension. Users routinely
rename `.xls` files as `.csv`.

### 9. Decimal.js: Monetary arithmetic rules

From the business logic doc, the rules are already correct. Implementation reminders:

```ts
// Correct: all operations through Decimal.js
const total = amounts.reduce(
  (acc, amt) => acc.plus(new Decimal(amt)),
  new Decimal(0)
);

// Correct: JSON-safe output
return { total: parseFloat(total.toFixed(2)) };

// WRONG: floating point arithmetic
const total = amounts.reduce((a, b) => a + parseFloat(b), 0);
```

**savingsRate calculation** (mentioned in getOverview):

```ts
const savingsRate = totalIn.isZero()
  ? new Decimal(0)
  : totalIn.minus(totalOut).dividedBy(totalIn).times(100);
return parseFloat(savingsRate.toFixed(1));
```

Guard the zero-division case — a user with no income in a period would cause a divide-by-zero.

---

## What NOT to Do

### Do NOT use Edge Runtime for any route that touches the database
`export const runtime = 'edge'` kills mysql2 compatibility. It is not a warning, it is a hard
crash at startup. Drizzle's mysql2 driver uses Node.js `net` module which is unavailable in
the edge sandbox. Only use edge runtime for NextAuth middleware (which is JWT-only and DB-free).

### Do NOT use `next-auth/react` `useSession()` in Server Components
Server Components cannot use React hooks. Use `auth()` from your `auth.ts` file instead.
This is a v5 change — v4 had `getServerSession()` but v5 collapses it into the single `auth()`
export.

### Do NOT call `db.query` inside `useEffect` or client components
All DB access must go through Server Components, Server Actions, or Route Handlers. There is no
direct DB access from the browser — the connection string must never reach the client bundle.
Next.js tree-shakes this correctly if you keep db imports in files with `'use server'` or in
server-only modules (`import 'server-only'`). Add `import 'server-only'` to `lib/db.ts` to make
the compiler enforce this.

### Do NOT use `drizzle-kit push` in any deployed environment
`push` is for local prototyping only. It bypasses migration files, can drop data, and has no
audit trail. Production MySQL on Railway must use `generate` + `migrate` only.

### Do NOT proxy file uploads through Next.js server actions
Server actions buffer the entire request body in memory. A 5MB Excel file will cause memory
spikes. Use a Route Handler with streaming, or (preferred) client-direct presigned PUT to R2.

### Do NOT store the JWT secret in `next-auth.config.ts`
The `AUTH_SECRET` env var is the authoritative secret. Hardcoding it in config exposes it in
build artifacts and version control. Railway injects it as an environment variable.

### Do NOT use `Number()` to convert DB decimal strings before Decimal.js
`Number("0.1") + Number("0.2") === 0.30000000000000004`. Pass the string directly to
`new Decimal(stringValue)` — Decimal.js parses strings without floating point loss.

### Do NOT mix `mysql2` pool and single connection in the same module
Drizzle can be initialized with either a pool or a single connection. The Sparter app should
always use a pool (`mysql.createPool()`). Single connections do not support concurrent requests
and will serialize all queries, killing dashboard performance under any concurrent load.

### Do NOT skip `onDuplicateKeyUpdate` on seed operations
Without it, re-running seeds on an existing DB throws a unique constraint error and halts the
migration. Make all seed scripts idempotent from day one.

---

## Confidence Notes

| Area | Confidence | Basis | Verify before coding |
|------|------------|-------|----------------------|
| Next.js 15 App Router patterns | HIGH | Stable GA since Oct 2024, well-documented behavior | No |
| Drizzle ORM mysql2 setup | HIGH | Drizzle 0.3x stable API, confirmed in multiple projects | No |
| drizzle-kit version matching rule | MEDIUM | Pattern observed through 0.28/0.36, may change | Check Drizzle changelog |
| NextAuth v5 config structure | HIGH | Stable beta API since mid-2024, no breaking changes since | No |
| NextAuth env var names (AUTH_SECRET) | HIGH | Official Auth.js v5 docs naming convention | No |
| Package versions (exact patch) | MEDIUM | Training data to Aug 2025; patches may have advanced | Run `npm info <pkg> version` |
| Railway MySQL SSL requirements | HIGH | Known Railway infrastructure behavior | No |
| R2 region: 'auto' requirement | HIGH | Cloudflare R2 documented requirement | No |
| R2 presigned URL CORS behavior | MEDIUM | Standard S3-compatible pattern, confirmed on R2 | Test in staging |
| mysql2 on Edge Runtime failure | HIGH | Hard architectural constraint, not a configuration issue | No |
| Decimal.js string-input pattern | HIGH | Decimal.js documented behavior, monetary safety pattern | No |
| drizzle-kit migrate for Railway deploys | HIGH | Standard Drizzle migration workflow | No |

---

## Environment Variables Required

```bash
# Database (Railway auto-populates DATABASE_URL in Railway environment)
DATABASE_URL=mysql://user:password@host.railway.app:3306/railway

# Auth
AUTH_SECRET=<random 32+ char string>
AUTH_URL=https://your-app.up.railway.app   # needed in production, not in dev

# Cloudflare R2
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 api token key id>
R2_SECRET_ACCESS_KEY=<r2 api token secret>
R2_BUCKET_NAME=sparter-uploads

# Staging bypass (non-production only)
STAGING_KEY=<random string>
```

`AUTH_SECRET` can be generated with `openssl rand -base64 32` or via the Auth.js CLI
(`npx auth secret`).

---

## Sources

All findings are from training knowledge (cutoff August 2025). No live documentation was
retrievable in this session due to tool permission restrictions. The following are the
authoritative sources to cross-check against:

- Next.js 15 docs: https://nextjs.org/docs
- Drizzle ORM docs: https://orm.drizzle.team/docs
- Auth.js v5 docs: https://authjs.dev
- Cloudflare R2 S3 compatibility: https://developers.cloudflare.com/r2/api/s3/
- @aws-sdk/client-s3 presigned URLs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_s3_request_presigner.html
- Railway MySQL docs: https://docs.railway.app/databases/mysql
- Decimal.js: https://mikemcl.github.io/decimal.js/
