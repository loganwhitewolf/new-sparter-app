// Stub for the 'server-only' package in the Vitest environment.
// Next.js 'server-only' throws when imported outside RSC; in Vitest (Node.js)
// this alias replaces it with a no-op so DAL modules can be imported by tests.
export {}
