'use client'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  backHref: string
  title: ReactNode
  amount?: ReactNode
  primaryAction?: ReactNode
  overflowMenu?: ReactNode
  /** Core-fields card slot — first in the fixed stacking order (D-01). */
  datiCard?: ReactNode
  /** Category card slot. */
  categoriaCard?: ReactNode
  /** Cross-references card slot. */
  collegamentiCard?: ReactNode
  /** Summary card slot — expense page only. */
  riepilogoCard?: ReactNode
  /** Linked transactions card slot — expense page only. */
  transactionsCard?: ReactNode
}

/**
 * Shared header + card-section shell for the transaction and expense detail
 * pages (D-02). Mobile-first single column, no sidebar grid (D-01). Card
 * slots render only when provided, in a fixed stacking order: core fields,
 * category, cross-references, summary, linked transactions.
 */
export function DetailPageShell({
  backHref,
  title,
  amount,
  primaryAction,
  overflowMenu,
  datiCard,
  categoriaCard,
  collegamentiCard,
  riepilogoCard,
  transactionsCard,
}: Props) {
  const router = useRouter()

  // D-08 smart back: prefer in-app history (preserves the origin table's
  // filters/sort/scroll position) and fall back to the static `backHref`
  // route only when there is no usable in-app history — a fresh tab, an
  // external referrer, or a directly-opened URL. The underlying element
  // stays a real `<a href={backHref}>` so SSR/no-JS clients and a failed/
  // missed JS path still degrade to a normal navigable link (T-64-10).
  function handleBackClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()

    if (typeof window === 'undefined') {
      router.push(backHref)
      return
    }

    const hasNoHistory = window.history.length <= 1
    const referrer = document.referrer
    const isExternalReferrer = (() => {
      if (referrer === '') return false
      try {
        return new URL(referrer).origin !== window.location.origin
      } catch {
        return true
      }
    })()

    if (hasNoHistory || isExternalReferrer) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <a
        href={backHref}
        onClick={handleBackClick}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Indietro
      </a>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {amount ? <div className="mt-1 text-lg font-semibold">{amount}</div> : null}
        </div>
        {primaryAction || overflowMenu ? (
          <div className="flex shrink-0 items-center gap-2">
            {primaryAction}
            {overflowMenu}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-4">
        {datiCard ? (
          <Card>
            <CardContent>{datiCard}</CardContent>
          </Card>
        ) : null}
        {categoriaCard ? (
          <Card>
            <CardContent>{categoriaCard}</CardContent>
          </Card>
        ) : null}
        {collegamentiCard ? (
          <Card>
            <CardContent>{collegamentiCard}</CardContent>
          </Card>
        ) : null}
        {riepilogoCard ? (
          <Card>
            <CardContent>{riepilogoCard}</CardContent>
          </Card>
        ) : null}
        {transactionsCard ? (
          <Card>
            <CardContent>{transactionsCard}</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
