import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

// PROTOTYPE AREA — throwaway demos for external stakeholders.
// Lives OUTSIDE the authenticated (app) group: no session check, no onboarding gate.
// Enabled only where PROTOTYPES_ENABLED is set — that env is scoped to Vercel Preview,
// so this whole subtree is a 404 in Production (even if the branch is merged).
export const metadata = {
  robots: { index: false, follow: false },
}

export default function ProtoLayout({ children }: { children: ReactNode }) {
  if (!process.env.PROTOTYPES_ENABLED) {
    notFound()
  }

  return <main className="h-screen overflow-hidden bg-background p-4">{children}</main>
}
