// PROTOTYPE — wipe me.
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import overviewHeroPlaceholder from './assets/overview-hero-placeholder.svg'

export function VariantC() {
  return (
    <div className="flex min-h-screen flex-col">
      <section className="flex flex-col items-center justify-center px-6 pt-28 pb-16 text-center sm:px-12">
        <p className="mb-6 text-sm font-medium tracking-[0.3em] text-muted-foreground uppercase">Sparter</p>
        <h1 className="mx-auto mb-6 max-w-4xl font-[family-name:var(--font-branding-display)] text-6xl leading-[1.02] text-foreground sm:text-7xl lg:text-8xl">
          Le tue spese, senza sorprese.
        </h1>
        <p className="mx-auto mb-10 max-w-md text-base text-muted-foreground">
          Carica gli estratti conto in pochi secondi. Sparter categorizza ogni movimento e ti mostra dove va ogni
          euro — senza collegare la banca.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Registrati</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Entra</Link>
          </Button>
        </div>
      </section>

      <section className="relative w-full border-y border-border">
        <div className="relative aspect-[16/7] w-full">
          <Image
            src={overviewHeroPlaceholder}
            alt="Placeholder per l'anteprima della dashboard Sparter"
            fill
            priority
            className="object-cover"
          />
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-20 text-center sm:px-12">
        <div>
          <h2 className="mb-2 font-[family-name:var(--font-branding-display)] text-2xl text-foreground">
            Categorizzazione automatica
          </h2>
          <p className="text-sm text-muted-foreground">
            Ogni movimento va al posto giusto, subito. Le regole imparano dalle tue correzioni.
          </p>
        </div>
        <div>
          <h2 className="mb-2 font-[family-name:var(--font-branding-display)] text-2xl text-foreground">
            Scopri le deviazioni
          </h2>
          <p className="text-sm text-muted-foreground">
            Confronta il mese corrente con la tua media e scopri dove stai spendendo di più.
          </p>
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
