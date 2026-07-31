// D-11: one copy set per direction, resolved centrally — the same one-site rule Phase 82
// established with resolveComparisonJudgement (lib/services/pace-and-projection.ts). No widget
// in the Categories list carries its own local copy; every direction-scoped string the list needs
// comes from this single switch. Strings are the exact rows from
// .planning/phases/83-categories-list/83-UI-SPEC.md's `## Copywriting Contract` table.

export type CategoryDirectionCopy = {
  pageSubheading: string
  shareLabel: string
  emptyStateHeading: string
  emptyStateBody: string
  directionLabel: string
}

/**
 * Resolves every direction-scoped Italian copy string the Categories list needs: page
 * subheading, row share label, empty-state heading/body, and the direction filter button label.
 * `pageSubheading` keeps its `{year}` placeholder literal — the caller interpolates it.
 *
 * The switch has no default/fallback case: it is exhaustive over the 3-member direction union, so
 * TypeScript enforces every branch is filled — a future 4th direction cannot be added with only
 * some of its copy set.
 */
export function resolveCategoryDirectionCopy(direction: 'in' | 'out' | 'allocation'): CategoryDirectionCopy {
  switch (direction) {
    case 'out':
      return {
        pageSubheading: 'Dove spendi di più nel {year}, e dove arrivi a questo ritmo.',
        shareLabel: '· {P}% del totale',
        emptyStateHeading: 'Nessuna spesa',
        emptyStateBody:
          "Non ci sono transazioni importate per questa direzione in {year}. Prova un altro anno o un'altra direzione.",
        directionLabel: 'Uscite',
      }
    case 'in':
      return {
        pageSubheading: 'Dove entrano i soldi nel {year}, e dove arrivi a questo ritmo.',
        shareLabel: '· {P}% del totale ricevuto',
        emptyStateHeading: 'Nessuna entrata',
        emptyStateBody:
          "Non ci sono transazioni importate per questa direzione in {year}. Prova un altro anno o un'altra direzione.",
        directionLabel: 'Entrate',
      }
    case 'allocation':
      return {
        pageSubheading: 'Dove destini risorse nel {year}, e dove arrivi a questo ritmo.',
        shareLabel: '· {P}% del totale destinato',
        emptyStateHeading: 'Nessun accantonamento',
        emptyStateBody:
          "Non ci sono transazioni importate per questa direzione in {year}. Prova un altro anno o un'altra direzione.",
        directionLabel: 'Accantonamenti',
      }
  }
}
