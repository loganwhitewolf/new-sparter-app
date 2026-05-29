import type { ReactNode } from 'react'
import { ProgressDots } from '@/app/(app)/onboarding/_components/progress-dots'

type OnboardingShellProps = {
  step: 1 | 2 | 3 | 4 | 5
  theme?: 'dark' | 'light'
  children: ReactNode
  footer?: ReactNode
}

/**
 * Full-screen hero shell for the onboarding flow (R-OB-09 / D-09).
 * Uses data-theme attribute to remap design-system CSS tokens to the Variant B palette.
 * No hardcoded slate-* or hex values — all colours come from the token layer in globals.css.
 */
export function OnboardingShell({ step, theme = 'dark', children, footer }: OnboardingShellProps) {
  return (
    <div
      data-theme={theme === 'dark' ? 'onboarding-dark' : 'onboarding-light'}
      className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground"
    >
      {/* Header — wordmark + progress dots */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <span className="text-sm font-semibold tracking-wide text-foreground/90">
          Sparter
        </span>
        <ProgressDots current={step} theme={theme} />
      </div>

      {/* Step content */}
      {children}

      {/* Optional sticky bottom CTA bar */}
      {footer && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4">
          <div className="mx-auto max-w-xl">
            {footer}
          </div>
        </div>
      )}
    </div>
  )
}
