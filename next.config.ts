import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  // better-auth statically pulls @better-auth/kysely-adapter, which imports
  // DEFAULT_MIGRATION_LOCK_TABLE from kysely's `export *` barrel. webpack can't resolve
  // that re-export when bundling, producing "Attempted import error" on the Vercel build.
  // These are server-only deps (auth runs server-side), so leave them external and let
  // Node resolve them at runtime where the ESM barrel works.
  serverExternalPackages: ['better-auth', '@better-auth/kysely-adapter', 'kysely'],
}

export default nextConfig
