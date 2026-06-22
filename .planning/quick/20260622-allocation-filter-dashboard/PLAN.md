---
slug: allocation-filter-dashboard
title: Dashboard — filtro per nature investimento/risparmio
status: in-progress
---

## Goal

Rendere i chip "Risparmio" e "Investimento" nel gruppo Accantonamento della dashboard interattivi (toggle), così come già lo sono i chip Entrate e Uscite.

## Files to change

1. `components/dashboard/overview/overview-chart-utils.ts`
   - `deriveFilteredBarRow`: accetta `includedAllocation` e somma solo le chiavi incluse
   - `deriveNatureBreakdown`: accetta `includedAllocation` e filtra allocation items

2. `components/dashboard/overview/overview-chart-filters.tsx`
   - Aggiunge `includedAllocation: Set<AllocationKey>` e `onToggleAllocation` alle props
   - Sostituisce `<span>` con `FilterChip` per i chip allocation
   - Aggiorna `allIncluded` per includere la check allocation

3. `components/dashboard/overview/overview-chart.tsx`
   - Aggiunge stato `includedAllocation` (default: tutti inclusi)
   - Aggiunge `handleToggleAllocation`
   - Aggiorna `handleReset` per includere allocation
   - Passa le nuove props a `OverviewChartFilters` e `NatureTooltip`
   - Aggiorna `rows` e tooltip

## No DAL changes needed — solo UI
