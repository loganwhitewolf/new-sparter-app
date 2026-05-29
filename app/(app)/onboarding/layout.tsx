// Onboarding route group — bypasses app shell per D-09 + D-11.
import type { ReactNode } from 'react'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {children}
    </main>
  )
}
