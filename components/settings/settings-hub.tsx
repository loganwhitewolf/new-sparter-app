import Link from 'next/link'
import { ChevronRight, FolderTree, Tags, UserCog } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { APP_ROUTES } from '@/lib/routes'

interface HubItem {
  href: string
  title: string
  description: string
  icon: typeof FolderTree
}

const HUB_ITEMS: HubItem[] = [
  {
    href: APP_ROUTES.profileSettings,
    title: 'Profilo',
    description: 'Dati personali, piano, e account collegati.',
    icon: UserCog,
  },
  {
    href: APP_ROUTES.categorySettings,
    title: 'Categorie',
    description: 'Tassonomia delle categorie e pattern di categorizzazione.',
    icon: FolderTree,
  },
  {
    href: APP_ROUTES.tagSettings,
    title: 'Tag',
    description: 'Crea e gestisci i tag per organizzare le tue transazioni.',
    icon: Tags,
  },
]

export function SettingsHub() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {HUB_ITEMS.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group block">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <CardTitle>{title}</CardTitle>
                </div>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Aspetto section (D-11/D-12) */}
      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Aspetto</p>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Tema</p>
            <p className="text-xs text-muted-foreground">Chiaro o scuro</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
