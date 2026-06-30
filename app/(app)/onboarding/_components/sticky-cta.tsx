'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_ROUTES } from '@/lib/routes'

type StickyCta = {
  step: 1 | 2 | 3 | 4 | 5
}

const CTA_LABELS: Partial<Record<1 | 2 | 3 | 4 | 5, string>> = {
  2: 'Continua a categorizzare',
  3: 'Inizia la categorizzazione',
  4: 'Categorizza il resto dopo',
}

/**
 * Sticky bottom CTA rendered on steps 2-4.
 * Step 1 auto-advances after upload; Step 5 has final page-level CTAs.
 * Uses design-system tokens only — no hardcoded colors (D-09).
 */
export function StickyCta({ step }: StickyCta) {
  const label = CTA_LABELS[step]
  if (!label) return null

  const nextStep = (step + 1) as 1 | 2 | 3 | 4 | 5

  return (
    <div className="flex gap-3">
      <Button asChild className="flex-1">
        <Link href={`${APP_ROUTES.onboarding}?step=${nextStep}`}>
          {label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}
