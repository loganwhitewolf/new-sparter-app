// PROTOTYPE — wipe me.
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import overviewHeroPlaceholder from './assets/overview-hero-placeholder.svg'

export function VariantA() {
  return (
    <div className="flex min-h-screen flex-col">
      <section className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-foreground">
        <Image
          src={overviewHeroPlaceholder}
          alt="Placeholder per l'anteprima della dashboard Sparter"
          fill
          priority
          className="object-cover opacity-90"
        />

        <div className="relative z-10 bg-gradient-to-t from-background via-background/95 to-transparent px-6 pt-32 pb-14 text-center sm:px-12">
          <p className="mb-4 text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">Sparter</p>
          <h1 className="mx-auto mb-4 max-w-2xl font-[family-name:var(--font-branding-display)] text-4xl leading-tight text-foreground sm:text-5xl">
            Le tue finanze, finalmente chiare.
          </h1>
          <p className="mx-auto mb-8 max-w-md text-base text-muted-foreground">
            Carica gli estratti conto, Sparter categorizza ogni movimento e ti mostra dove va ogni euro. Nessun
            collegamento bancario: solo i tuoi file.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Registrati</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Entra</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-10 px-6 py-20 sm:grid-cols-2 sm:px-12">
        <div>
          <h2 className="mb-2 font-[family-name:var(--font-branding-display)] text-xl text-foreground">
            Categorizzazione automatica
          </h2>
          <p className="text-sm text-muted-foreground">
            Ogni movimento va al posto giusto, subito. Le regole imparano dalle tue correzioni.
          </p>
        </div>
        <div>
          <h2 className="mb-2 font-[family-name:var(--font-branding-display)] text-xl text-foreground">
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
