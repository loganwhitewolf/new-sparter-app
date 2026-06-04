'use client'
// PROTOTYPE — wipe me. Floating variant switcher (hidden in production builds).
import { useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const VARIANTS = [
  { key: 'A', name: 'Sort sugli header' },
  { key: 'B', name: 'Due sezioni etichettate' },
  { key: 'C', name: 'Ingresso unico a tab' },
] as const

export function PrototypeSwitcher({ current }: { current: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const go = useCallback(
    (dir: number) => {
      const idx = VARIANTS.findIndex((v) => v.key === current)
      const next = VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length].key
      const params = new URLSearchParams(searchParams.toString())
      params.set('variant', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [current, searchParams, router, pathname],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return
      if ((el as HTMLElement | null)?.isContentEditable) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (process.env.NODE_ENV === 'production') return null

  const meta = VARIANTS.find((v) => v.key === current) ?? VARIANTS[0]

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-foreground/20 bg-foreground px-2 py-1.5 text-background shadow-lg">
      <button type="button" onClick={() => go(-1)} aria-label="Variante precedente" className="px-2 text-lg leading-none">
        ‹
      </button>
      <span className="min-w-[14rem] text-center font-mono text-sm">
        {meta.key} — {meta.name}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Variante successiva" className="px-2 text-lg leading-none">
        ›
      </button>
    </div>
  )
}
