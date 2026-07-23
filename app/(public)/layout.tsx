import Link from 'next/link'
import { MARKETING_ROUTES } from '@/lib/routes'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link
            href={MARKETING_ROUTES.home}
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Sparter
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
