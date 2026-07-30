import { cn } from '@/lib/utils'

type SparterMarkProps = {
  className?: string
}

/**
 * Placeholder brand mark for the sidebar header.
 * Swap the inner glyph for the official logo asset when available — keep this
 * shell so toggle chrome (chevron) stays UI, not part of the brand SVG.
 */
export function SparterMark({ className }: SparterMarkProps) {
  return (
    <span
      aria-hidden
      data-sparter-mark
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold tracking-tight text-primary-foreground',
        className
      )}
    >
      S
    </span>
  )
}
