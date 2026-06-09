'use client'

import { createContext, useContext, useEffect, useState } from 'react'

// D-13: Sidebar collapsed state context shape
type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

// D-05: Stable localStorage key for sidebar collapse state
const STORAGE_KEY = 'sparter-sidebar-collapsed'

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // D-14: Default SSR state is false (expanded) — never read localStorage in useState initializer
  // This avoids hydration mismatch (Pitfall 1): server renders expanded, client restores from storage
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Read localStorage only after mount to prevent SSR/hydration mismatch
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  // Wrapper setter: syncs React state and persists to localStorage
  // Writing localStorage after mount is safe — this only fires from user interaction
  const handleSetCollapsed = (v: boolean) => {
    setCollapsed(v)
    localStorage.setItem(STORAGE_KEY, String(v))
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed: handleSetCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarCollapsed(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (ctx === null) {
    throw new Error('useSidebarCollapsed must be used within SidebarProvider')
  }
  return ctx
}
