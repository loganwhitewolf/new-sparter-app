import { verifySession } from '@/lib/dal/auth'
import { parseOnboardingStep } from '@/lib/validations/onboarding'
import { OnboardingShell } from '@/app/(app)/onboarding/_components/onboarding-shell'
import { Step1Upload } from '@/app/(app)/onboarding/_components/step-1-upload'
import { Step2Overview } from '@/app/(app)/onboarding/_components/step-2-overview'
import { Step3Education } from '@/app/(app)/onboarding/_components/step-3-education'
import { StickyCta } from '@/app/(app)/onboarding/_components/sticky-cta'

type OnboardingPageProps = {
  searchParams: Promise<{ step?: string | string[] }>
}

/**
 * RSC entry point for the /onboarding route.
 * Parses the ?step search param, verifies the session, and renders the appropriate step.
 * Steps 4 and 5 are implemented in Plan 38-03.
 */
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams
  const step = parseOnboardingStep(params.step)

  const { userId } = await verifySession()

  // Step 4 uses a light theme (categorisation = active work); all others are dark
  const theme = step === 4 ? 'light' : 'dark'

  // Show sticky CTA on steps 2 and 3; step 1 auto-advances on upload, steps 4/5 handled later
  const footer = step >= 2 && step <= 3 ? <StickyCta step={step} /> : undefined

  return (
    <OnboardingShell step={step} theme={theme} footer={footer}>
      {step === 1 && <Step1Upload />}
      {step === 2 && <Step2Overview userId={userId} />}
      {step === 3 && <Step3Education userId={userId} />}
      {(step === 4 || step === 5) && (
        <p data-testid="step-placeholder">Step {step} arriva con Plan 38-03</p>
      )}
    </OnboardingShell>
  )
}
