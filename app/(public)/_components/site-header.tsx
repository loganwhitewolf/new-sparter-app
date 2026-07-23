'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { APP_ROUTES, AUTH_PAGE_ROUTES, MARKETING_ROUTES } from '@/lib/routes'

function navLinkClassName(isActive: boolean) {
  return cn(
    'text-sm transition-colors',
    isActive ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={MARKETING_ROUTES.home}
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Sparter
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Principale">
          <Link
            href={MARKETING_ROUTES.howItWorks}
            className={navLinkClassName(pathname === MARKETING_ROUTES.howItWorks)}
          >
            Come funziona
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="outline" size="sm">
            <Link href={AUTH_PAGE_ROUTES.login}>Entra</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={AUTH_PAGE_ROUTES.register}>Registrati</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button asChild size="sm">
            <Link href={AUTH_PAGE_ROUTES.register}>Registrati</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Apri menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false}>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Chiudi menu"
                    className="absolute top-4 right-4"
                  >
                    <span aria-hidden>&times;</span>
                  </Button>
                </SheetClose>
              </SheetHeader>
              <nav aria-label="Menu principale" className="flex flex-col gap-1 px-4 pb-4">
                <Link
                  href={MARKETING_ROUTES.howItWorks}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 py-3',
                    navLinkClassName(pathname === MARKETING_ROUTES.howItWorks)
                  )}
                >
                  Come funziona
                </Link>
                <Link
                  href={AUTH_PAGE_ROUTES.login}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Entra
                </Link>
                <Link
                  href={AUTH_PAGE_ROUTES.register}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Registrati
                </Link>

                <Separator className="my-2" />

                <Link
                  href={MARKETING_ROUTES.privacy}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 py-3',
                    navLinkClassName(pathname === MARKETING_ROUTES.privacy)
                  )}
                >
                  Privacy
                </Link>
                <Link
                  href={MARKETING_ROUTES.terms}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 py-3',
                    navLinkClassName(pathname === MARKETING_ROUTES.terms)
                  )}
                >
                  Termini
                </Link>
                <Link
                  href={APP_ROUTES.dashboard}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
