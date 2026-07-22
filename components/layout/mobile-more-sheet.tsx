'use client'

import Link from 'next/link'
import { FolderTree, Regex, Tags, User } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { APP_ROUTES } from '@/lib/routes'

export const MORE_SHEET_ROUTES = [
  APP_ROUTES.categorySettings,
  APP_ROUTES.tags,
  APP_ROUTES.patterns,
  APP_ROUTES.profileSettings,
]

const moreSheetItems = [
  { href: APP_ROUTES.categorySettings, label: 'Categorie', icon: FolderTree },
  { href: APP_ROUTES.tags, label: 'Tag', icon: Tags },
  { href: APP_ROUTES.patterns, label: 'Pattern', icon: Regex },
  { href: APP_ROUTES.profileSettings, label: 'Profilo', icon: User },
]

type MobileMoreSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Altro</SheetTitle>
        </SheetHeader>
        <nav aria-label="Altre sezioni" className="flex flex-col gap-1 px-4 pb-4">
          {moreSheetItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
