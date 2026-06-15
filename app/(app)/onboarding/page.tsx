import type { ReactNode } from "react";
import { verifySession } from "@/lib/dal/auth";
import { markOnboardingCompleted } from "@/lib/dal/users";
import {
  onboardingThemeForStep,
  parseOnboardingStep,
} from "@/lib/validations/onboarding";
import { OnboardingShell } from "@/app/(app)/onboarding/_components/onboarding-shell";
import { Step1Upload } from "@/app/(app)/onboarding/_components/step-1-upload";
import { Step2Overview } from "@/app/(app)/onboarding/_components/step-2-overview";
import { Step3Education } from "@/app/(app)/onboarding/_components/step-3-education";
import { Step4Categorize } from "@/app/(app)/onboarding/_components/step-4-categorize";
import { Step5Outro } from "@/app/(app)/onboarding/_components/step-5-outro";
import { StickyCta } from "@/app/(app)/onboarding/_components/sticky-cta";

type OnboardingPageProps = {
  searchParams: Promise<{ step?: string | string[] }>;
};

/**
 * RSC entry point for the /onboarding route.
 * Parses the ?step search param, verifies the session, and renders the appropriate step.
 */
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;
  const step = parseOnboardingStep(params.step);

  const { userId } = await verifySession();

  // Theme is resolved by the documented onboardingThemeForStep invariant (step 4 = light).
  // Do not re-derive it inline — see lib/validations/onboarding.ts for the source of truth.
  const theme = onboardingThemeForStep(step);

  // Show sticky CTA on steps 2-4; step 1 auto-advances on upload and step 5 has final CTAs.
  const footer = step >= 2 && step <= 4 ? <StickyCta step={step} /> : undefined;
  let content: ReactNode;

  if (step === 1) {
    content = <Step1Upload />;
  } else if (step === 2) {
    content = <Step2Overview userId={userId} />;
  } else if (step === 3) {
    content = <Step3Education userId={userId} />;
  } else if (step === 4) {
    content = await Step4Categorize({ userId });
  } else {
    await markOnboardingCompleted(userId);
    content = <Step5Outro />;
  }

  return (
    <OnboardingShell step={step} theme={theme} footer={footer}>
      {content}
    </OnboardingShell>
  );
}
