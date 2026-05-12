'use client'

import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  icon: LucideIcon
  className?: string
  /** Decorative icons: hide placeholder and SVG from assistive tech. */
  ariaHidden?: boolean
}

/**
 * Renders a same-size placeholder until the client mounts so SSR HTML matches the first client
 * paint. Helps avoid hydration mismatches when browser extensions mutate inline SVG before React
 * hydrates (e.g. Dark Reader injecting data attributes / inline styles).
 */
export function ClientMountIcon({ icon: Icon, className, ariaHidden }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const hiddenProp = ariaHidden ? true : undefined

  if (!mounted) {
    return (
      <span
        className={cn('inline-block shrink-0', className)}
        aria-hidden={hiddenProp}
      />
    )
  }

  return <Icon className={className} aria-hidden={hiddenProp} />
}
