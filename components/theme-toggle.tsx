'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      disabled={!mounted}
      onClick={
        mounted ? () => setTheme(isDark ? 'light' : 'dark') : undefined
      }
      aria-label={
        !mounted ? 'Tema' : isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'
      }
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : null}
    </Button>
  )
}
