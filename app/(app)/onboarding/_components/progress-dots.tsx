'use client'

import { STEP_NAMES } from '@/lib/validations/onboarding'

type ProgressDotsProps = {
  current: 1 | 2 | 3 | 4 | 5
  theme?: 'dark' | 'light'
}

/**
 * Five-dot progress indicator with the current step label.
 * Uses design-system tokens only — no hardcoded slate-* or hex values (D-09).
 * In dark theme, foreground is resolved via the [data-theme="onboarding-dark"] override.
 */
export function ProgressDots({ current, theme = 'dark' }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5 items-center">
        {([1, 2, 3, 4, 5] as const).map((i) => {
          const isActive = i === current
          const isPast = i < current

          // Token-based opacity classes — these reference --foreground via the
          // [data-theme] override on OnboardingShell, so components stay token-only.
          let dotClass: string
          if (isActive) {
            dotClass = 'h-2 w-2 bg-foreground'
          } else if (isPast) {
            dotClass = 'h-1.5 w-1.5 bg-foreground/50'
          } else {
            dotClass = 'h-1.5 w-1.5 bg-foreground/20'
          }

          return (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${dotClass}`}
              aria-hidden="true"
            />
          )
        })}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {STEP_NAMES[current]}
      </span>
    </div>
  )
}
