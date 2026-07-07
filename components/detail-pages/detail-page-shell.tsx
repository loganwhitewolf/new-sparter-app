'use client'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type DetailPageLayout = 'stacked' | 'two-column' | 'file-detail'

type Props = {
  backHref: string
  title: ReactNode
  amount?: ReactNode
  amountInline?: boolean
  amountToneClassName?: string
  primaryAction?: ReactNode
  overflowMenu?: ReactNode
  /** `stacked` (default): single column. `two-column`: dati left, sidebar right on lg+. */
  layout?: DetailPageLayout
  /** Core-fields card slot — first in the fixed stacking order (D-01). */
  datiCard?: ReactNode
  /** Category card slot. */
  categoriaCard?: ReactNode
  /** Cross-references card slot. */
  collegamentiCard?: ReactNode
  /** Visible actions card — transaction detail page (replaces overflow menu). */
  azioniCard?: ReactNode
  /** Summary card slot — expense page only. */
  riepilogoCard?: ReactNode
  /** Linked transactions card slot — expense page only. */
  transactionsCard?: ReactNode
  /** In two-column mode, place summary + transactions side by side on lg+. */
  bottomCardsSideBySide?: boolean
}

function DetailCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/**
 * Registers a single-use 'popstate' listener on `target` that invokes
 * `onPopstate` once, then self-removes. Used to bust Next.js's back/forward
 * Client Cache exactly once per router.back() call, without accumulating
 * listeners across repeated back-navigations (T-64-11).
 */
export function attachPopstateRefresh(
  target: Pick<Window, 'addEventListener'>,
  onPopstate: () => void,
): void {
  target.addEventListener('popstate', onPopstate, { once: true })
}

/**
 * Pure signal for D-08 smart back: true when the browser session has more
 * than one history entry, meaning genuine in-app navigation history exists
 * to go back to. `document.referrer` is deliberately NOT used as a signal
 * here — it is set once at the tab's original hard navigation and never
 * updated by client-side App Router transitions, so it would silently and
 * permanently disable smart back for any tab that ever arrived from outside
 * the app, even once real in-app history has since accumulated (WR-02).
 */
export function hasInAppHistory(historyLength: number): boolean {
  return historyLength > 1
}

/**
 * Shared header + card-section shell for the transaction and expense detail
 * pages (D-02). Mobile-first single column by default (D-01). Optional
 * `two-column` layout places dati on the left and a sidebar (category,
 * cross-references, actions) on the right at lg+. Card slots render only when
 * provided, in a fixed stacking order: core fields, category, cross-references,
 * actions, summary, linked transactions.
 */
export function DetailPageShell({
  backHref,
  title,
  amount,
  amountInline = false,
  amountToneClassName,
  primaryAction,
  overflowMenu,
  layout = 'stacked',
  datiCard,
  categoriaCard,
  collegamentiCard,
  azioniCard,
  riepilogoCard,
  transactionsCard,
  bottomCardsSideBySide = false,
}: Props) {
  const router = useRouter()

  // D-08 smart back: prefer in-app history (preserves the origin table's
  // filters/sort/scroll position) and fall back to the static `backHref`
  // route only when there is no usable in-app history — a fresh tab or a
  // directly-opened URL. A browser's document-referrer signal is deliberately
  // not consulted: it is fixed at the tab's original hard navigation and
  // never updated by this framework's client-side route transitions, so
  // relying on it would silently and permanently disable smart back for any
  // tab that ever arrived from outside the app (WR-02). The underlying
  // element stays a real `<a href={backHref}>` so SSR/no-JS clients and a
  // failed/missed JS path still degrade to a normal navigable link (T-64-10).
  function handleBackClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()

    if (typeof window === 'undefined') {
      router.push(backHref)
      return
    }

    if (!hasInAppHistory(window.history.length)) {
      router.push(backHref)
    } else {
      // Next.js's back/forward Client Cache unconditionally reuses the
      // destination route's previously-rendered RSC payload (independent of
      // staleTimes.dynamic), so a filtered table can render a stale
      // pre-filter snapshot even though the URL is restored correctly. Arm a
      // one-time popstate listener BEFORE calling router.back() so it fires
      // after Next's own app-router popstate listener has already updated
      // the router's internal route state, then bust the cache for the
      // destination route with router.refresh() (preserves scroll position).
      attachPopstateRefresh(window, () => router.refresh())
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
        <div className="group min-w-0 flex-1">
          <h1
            className={cn(
              'truncate text-2xl font-bold tracking-tight',
              amountInline && 'flex items-baseline gap-2'
            )}
          >
            <span className="truncate">{title}</span>
            {amount && amountInline ? (
              <span
                className={cn(
                  'shrink-0 font-mono text-xl font-semibold tabular-nums',
                  amountToneClassName
                )}
              >
                {amount}
              </span>
            ) : null}
          </h1>
          {amount && !amountInline ? <div className="mt-1 text-lg font-semibold">{amount}</div> : null}
        </div>
        {primaryAction || overflowMenu ? (
          <div className="flex shrink-0 items-center gap-2">
            {primaryAction}
            {overflowMenu}
          </div>
        ) : null}
      </header>

      <div
        className={cn(
          'flex flex-col gap-4',
          layout === 'two-column' && 'lg:grid lg:grid-cols-5 lg:items-start',
          layout === 'file-detail' && 'lg:grid lg:grid-cols-5 lg:items-start',
        )}
      >
        {datiCard ? (
          <div
            className={cn(
              layout === 'two-column' && 'lg:col-span-3',
              layout === 'file-detail' && 'lg:col-span-3 lg:row-start-1',
            )}
          >
            <DetailCard>{datiCard}</DetailCard>
          </div>
        ) : null}
        {layout === 'file-detail' ? (
          <>
            {collegamentiCard ? (
              <div className="lg:col-span-2 lg:row-start-1">
                <DetailCard>{collegamentiCard}</DetailCard>
              </div>
            ) : null}
            {riepilogoCard || azioniCard ? (
              <div className="flex flex-col gap-4 lg:col-span-3 lg:row-start-2">
                {riepilogoCard ? <DetailCard>{riepilogoCard}</DetailCard> : null}
                {azioniCard ? <DetailCard>{azioniCard}</DetailCard> : null}
              </div>
            ) : null}
            {transactionsCard ? (
              <div className="lg:col-span-2 lg:row-start-2">
                <DetailCard>{transactionsCard}</DetailCard>
              </div>
            ) : null}
          </>
        ) : layout === 'two-column' ? (
          <>
            <div className="flex flex-col gap-4 lg:col-span-2">
              {categoriaCard ? <DetailCard>{categoriaCard}</DetailCard> : null}
              {collegamentiCard ? <DetailCard>{collegamentiCard}</DetailCard> : null}
              {azioniCard ? <DetailCard>{azioniCard}</DetailCard> : null}
            </div>
            {riepilogoCard || transactionsCard ? (
              <div
                className={cn(
                  'lg:col-span-5 grid gap-4',
                  bottomCardsSideBySide ? 'lg:grid-cols-2' : 'grid-cols-1',
                )}
              >
                {riepilogoCard ? <DetailCard>{riepilogoCard}</DetailCard> : null}
                {transactionsCard ? <DetailCard>{transactionsCard}</DetailCard> : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {categoriaCard ? <DetailCard>{categoriaCard}</DetailCard> : null}
            {collegamentiCard ? <DetailCard>{collegamentiCard}</DetailCard> : null}
            {azioniCard ? <DetailCard>{azioniCard}</DetailCard> : null}
            {riepilogoCard ? <DetailCard>{riepilogoCard}</DetailCard> : null}
            {transactionsCard ? <DetailCard>{transactionsCard}</DetailCard> : null}
          </>
        )}
      </div>
    </div>
  )
}
