import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // 'server-only' is a Next.js guard that throws when imported outside RSC.
      // In Vitest (Node.js, not Next.js runtime), mock it as an empty module so
      // tests can import DAL modules that carry the 'server-only' boundary marker.
      'server-only': fileURLToPath(new URL('./tests/__mocks__/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'lib/**/*.test.ts',
      'tests/category-settings-seed.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.claude/**',
      '**/.gsd/**',
      '**/*.spec.ts',
    ],
  },
})
