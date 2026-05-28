'use client'

// PROTOTYPE — flusso onboarding (3 varianti). Throwaway.
// Domanda: quale struttura di step funziona meglio per l'onboarding primo utente?
// Variante A: card minimalista | B: full-screen hero | C: sidebar wizard
// Eliminare tutto dopo aver scelto la variante vincente.
// Vedi: docs/adr/0005-first-import-onboarding-gate.md

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { VariantA } from './_variants/variant-a'
import { VariantB } from './_variants/variant-b'
import { VariantC } from './_variants/variant-c'
import { PrototypeSwitcher } from '@/components/ui/prototype-switcher'

function PrototypeInner() {
  const searchParams = useSearchParams()
  const variant = searchParams.get('variant') ?? 'A'

  return (
    <>
      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && <VariantC />}
      <PrototypeSwitcher />
    </>
  )
}

export default function OnboardingPrototypePage() {
  return (
    <Suspense>
      <PrototypeInner />
    </Suspense>
  )
}
