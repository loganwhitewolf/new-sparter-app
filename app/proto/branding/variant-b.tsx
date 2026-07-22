// PROTOTYPE — wipe me.
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import overviewHeroPlaceholder from './assets/overview-hero-placeholder.svg'

export function VariantB() {
  return (
    <div className="flex min-h-screen flex-col">
      <section className="grid min-h-screen items-center gap-10 px-6 py-20 sm:px-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:py-0">
        <div className="flex flex-col justify-center lg:pr-6">
          <p className="mb-6 text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">Sparter</p>
          <h1 className="mb-6 max-w-lg font-[family-name:var(--font-branding-display)] text-5xl leading-[1.05] text-foreground sm:text-6xl">
            Ogni euro, al suo posto.
          </h1>
          <p className="mb-8 max-w-sm text-base text-muted-foreground">
            Carica gli estratti conto: Sparter legge ogni movimento e ti mostra dove va, mese dopo mese. Nessun
            collegamento bancario, solo i tuoi file.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Registrati</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Entra</Link>
            </Button>
          </div>
        </div>

        <div className="relative aspect-[8/9] w-full overflow-hidden rounded-2xl border border-border shadow-2xl lg:translate-y-6">
          <Image
            src={overviewHeroPlaceholder}
            alt="Placeholder per l'anteprima della dashboard Sparter"
            fill
            priority
            className="object-cover"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl border-t border-border px-6 py-20 sm:px-12">
        <div className="grid gap-12 sm:grid-cols-2">
          <div className="flex gap-4">
            <span className="font-[family-name:var(--font-branding-display)] text-3xl text-muted-foreground/40">
              01
            </span>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Categorizzazione automatica</h2>
              <p className="text-sm text-muted-foreground">
                Ogni movimento va al posto giusto, subito. Le regole imparano dalle tue correzioni.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="font-[family-name:var(--font-branding-display)] text-3xl text-muted-foreground/40">
              02
            </span>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Scopri le deviazioni</h2>
              <p className="text-sm text-muted-foreground">
                Confronta il mese corrente con la tua media e scopri dove stai spendendo di più.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-16 text-center sm:px-12">
        <Button asChild size="lg">
          <Link href="/register">Registrati</Link>
        </Button>
      </section>
    </div>
  )
}
