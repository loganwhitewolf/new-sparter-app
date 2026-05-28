'use client'

// PROTOTYPE TOOL — non usare in produzione. Rimosso insieme ai prototipi.

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const VARIANTS = ['A', 'B', 'C'] as const
type Variant = (typeof VARIANTS)[number]

const VARIANT_NAMES: Record<Variant, string> = {
  A: 'Card minimalista',
  B: 'Full-screen hero',
  C: 'Sidebar wizard',
}

export function PrototypeSwitcher() {
  if (process.env.NODE_ENV === 'production') return null

  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get('variant') ?? 'A') as Variant
  const currentIdx = VARIANTS.indexOf(current)

  const go = (dir: 1 | -1) => {
    const next = VARIANTS[(currentIdx + dir + VARIANTS.length) % VARIANTS.length]
    const params = new URLSearchParams(searchParams.toString())
    params.set('variant', next)
    router.replace(`?${params.toString()}`)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-white shadow-2xl text-sm font-medium select-none">
      <button onClick={() => go(-1)} className="opacity-70 hover:opacity-100 transition-opacity">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[160px] text-center">
        {current} — {VARIANT_NAMES[current]}
      </span>
      <button onClick={() => go(1)} className="opacity-70 hover:opacity-100 transition-opacity">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
