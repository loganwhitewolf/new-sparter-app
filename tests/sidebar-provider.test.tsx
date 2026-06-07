/**
 * Unit tests for SidebarProvider and useSidebarCollapsed (D-13, D-14)
 *
 * Strategy: renderToStaticMarkup is synchronous — useEffect does not run, so we
 * test the SSR initial state (D-14) and the context shape (D-13) directly.
 * localStorage persistence (D-05) and collapse toggle are covered by layout.spec.ts (E2E).
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const { SidebarProvider, useSidebarCollapsed } = await import(
  '@/components/layout/sidebar-provider'
)

// Spy component: reads context and renders collapsed state as a data attribute
function CollapsedSpy() {
  const { collapsed } = useSidebarCollapsed()
  return React.createElement('div', { 'data-collapsed': String(collapsed) })
}

// Misbehaving component: calls hook outside provider
function OutsideConsumer() {
  useSidebarCollapsed()
  return null
}

describe('SidebarProvider (D-13, D-14)', () => {
  it('renders children without throwing', () => {
    expect(() =>
      renderToStaticMarkup(
        React.createElement(SidebarProvider, null, React.createElement('span', null, 'ok')),
      ),
    ).not.toThrow()
  })

  it('initial collapsed state is false on first render (D-14 — SSR-safe default)', () => {
    const html = renderToStaticMarkup(
      React.createElement(SidebarProvider, null, React.createElement(CollapsedSpy)),
    )
    expect(html).toContain('data-collapsed="false"')
  })

  it('context provides { collapsed: boolean, setCollapsed: fn } shape (D-13)', () => {
    let capturedCtx: ReturnType<typeof useSidebarCollapsed> | null = null

    function CtxCapture() {
      capturedCtx = useSidebarCollapsed()
      return null
    }

    renderToStaticMarkup(
      React.createElement(SidebarProvider, null, React.createElement(CtxCapture)),
    )

    expect(capturedCtx).not.toBeNull()
    expect(typeof (capturedCtx as NonNullable<typeof capturedCtx>).collapsed).toBe('boolean')
    expect(typeof (capturedCtx as NonNullable<typeof capturedCtx>).setCollapsed).toBe('function')
  })

  it('useSidebarCollapsed throws with correct message when used outside SidebarProvider', () => {
    expect(() => renderToStaticMarkup(React.createElement(OutsideConsumer))).toThrow(
      'useSidebarCollapsed must be used within SidebarProvider',
    )
  })
})
