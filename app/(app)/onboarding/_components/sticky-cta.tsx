'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { APP_ROUTES } from '@/lib/routes'

type StickyCta = {
  step: 1 | 2 | 3 | 4 | 5
}

const CTA_LABELS: Partial<Record<1 | 2 | 3 | 4 | 5, string>> = {
  2: 'Continua a categorizzare',
  3: 'Inizia la categorizzazione',
}

/**
 * Sticky bottom CTA rendered on steps 2 and 3.
 * Steps 1, 4, and 5 are excluded (step 1 auto-advances; steps 4/5 handled in Plan 38-03).
 * Uses design-system tokens only — no hardcoded colors (D-09).
 */
export function StickyCta({ step }: StickyCta) {
  const label = CTA_LABELS[step]
  if (!label) return null

  const nextStep = (step + 1) as 1 | 2 | 3 | 4 | 5

  return (
    <div className="flex gap-3">
      <Link
        href={`${APP_ROUTES.onboarding}?step=${nextStep}`}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
      >
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
