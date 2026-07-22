import { Fraunces } from 'next/font/google'

// Fraunces — contemporary display serif with editorial weight; avoids the
// Playfair + warm-cream/terracotta pairing flagged as a design cliche in 69-CONTEXT.md (D-08).
// Scoped to the branding hub only — root app/layout.tsx keeps Geist untouched.
export const brandingDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-branding-display',
  display: 'swap',
})
