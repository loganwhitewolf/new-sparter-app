import type { ReactNode } from 'react'
import { verifySession } from '@/lib/dal/auth'
import { parseOnboardingStep } from '@/lib/validations/onboarding'
import { OnboardingShell } from '@/app/(app)/onboarding/_components/onboarding-shell'
import { Step1Upload } from '@/app/(app)/onboarding/_components/step-1-upload'
import { Step2Overview } from '@/app/(app)/onboarding/_components/step-2-overview'
import { Step3Education } from '@/app/(app)/onboarding/_components/step-3-education'
import { Step4Categorize } from '@/app/(app)/onboarding/_components/step-4-categorize'
import { Step5Outro } from '@/app/(app)/onboarding/_components/step-5-outro'
import { StickyCta } from '@/app/(app)/onboarding/_components/sticky-cta'

type OnboardingPageProps = {
  searchParams: Promise<{ step?: string | string[] }>
}

/**
 * RSC entry point for the /onboarding route.
 * Parses the ?step search param, verifies the session, and renders the appropriate step.
 */
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams
  const step = parseOnboardingStep(params.step)

  const { userId } = await verifySession()

  // Step 4 uses a light theme (categorisation = active work); all others are dark
  const theme = step === 4 ? 'light' : 'dark'

  // Show sticky CTA on steps 2-4; step 1 auto-advances on upload and step 5 has final CTAs.
  const footer = step >= 2 && step <= 4 ? <StickyCta step={step} /> : undefined
  let content: ReactNode

  if (step === 1) {
    content = <Step1Upload />
  } else if (step === 2) {
    content = <Step2Overview userId={userId} />
  } else if (step === 3) {
    content = <Step3Education userId={userId} />
  } else if (step === 4) {
    content = await Step4Categorize({ userId })
  } else {
    content = <Step5Outro />
  }

  return (
    <OnboardingShell step={step} theme={theme} footer={footer}>
      {content}
    </OnboardingShell>
  )
}
