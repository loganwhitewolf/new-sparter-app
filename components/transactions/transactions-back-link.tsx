'use client'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import { attachPopstateRefresh, hasInAppHistory } from '@/components/detail-pages/detail-page-shell'

type Props = {
  backHref: string
}

/**
 * The "Torna indietro" affordance on `/transactions` (260804-jog D-02/D-03, NAV-03). `backHref`
 * has already been validated by `parseTransactionsBackParam` before this component ever receives
 * it — never render this with a raw, unvalidated URL.
 *
 * Mirrors `DetailPageShell`'s own smart-back click handler (D-03): a genuine `router.back()` is
 * preferred whenever in-app history exists (preserving the origin category detail page's own
 * year/view state), falling back to a real navigation to `backHref` only for a fresh tab / a
 * directly-opened link with no in-app history. This is a deliberate small duplication of that
 * shell's handler rather than a refactor of the shared component — this plan's footprint stays to
 * net-new/small files. The underlying element stays a real `<a href={backHref}>` (never a
 * `<button>`) so SSR/no-JS clients still degrade to a normal navigable link, matching
 * `DetailPageShell`'s own documented rationale.
 */
export function TransactionsBackLink({ backHref }: Props) {
  const router = useRouter()

  function handleBackClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()

    if (typeof window === 'undefined') {
      router.push(backHref)
      return
    }

    if (!hasInAppHistory(window.history.length)) {
      router.push(backHref)
    } else {
      attachPopstateRefresh(window, () => router.refresh())
      router.back()
    }
  }

  return (
    <a
      href={backHref}
      onClick={handleBackClick}
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Torna indietro
    </a>
  )
}
