import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

// PROTOTYPE AREA — throwaway demos for external stakeholders.
// Lives OUTSIDE the authenticated (app) group: no session check, no onboarding gate.
// Enabled only where PROTOTYPES_ENABLED is set — that env is scoped to Vercel Preview,
// so this whole subtree is a 404 in Production (even if the branch is merged).
// force-dynamic: ensure the env gate is evaluated at REQUEST time, not baked into a
// static prerender at build time (a build without the env would otherwise bake a 404).
export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default function ProtoLayout({ children }: { children: ReactNode }) {
  // DIAGNOSTIC (temporary): shows in Vercel deployment Runtime Logs.
  // If this line never logs → the request isn't reaching the route (middleware /
  // deployment protection / build). If it logs `undefined` → the env isn't present
  // at runtime (wrong scope or name). If it logs "1" but still 404 → look elsewhere.
  console.log('[proto] layout hit — PROTOTYPES_ENABLED =', JSON.stringify(process.env.PROTOTYPES_ENABLED))

  if (!process.env.PROTOTYPES_ENABLED) {
    console.log('[proto] gate CLOSED → notFound()')
    notFound()
  }

  return <main className="h-screen overflow-hidden bg-background p-4">{children}</main>
}
