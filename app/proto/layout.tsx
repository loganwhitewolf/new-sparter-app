import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

// PROTOTYPE AREA — throwaway demos. Lives OUTSIDE the authenticated (app) group.
// Enabled only where PROTOTYPES_ENABLED is set (scoped to Vercel Preview) → 404 in Production.
export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default function ProtoLayout({ children }: { children: ReactNode }) {
  if (!process.env.PROTOTYPES_ENABLED) {
    notFound()
  }

  return <main className="min-h-screen bg-background p-4 md:p-6">{children}</main>
}
