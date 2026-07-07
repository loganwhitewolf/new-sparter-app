# Quick Task 260707-crv: Transaction detail multi-column layout

## Tasks

### 1. Extend DetailPageShell
- Add `layout?: 'stacked' | 'two-column'` (default stacked)
- Add `azioniCard` slot
- Two-column: `lg:grid-cols-5`, dati `lg:col-span-3`, sidebar `lg:col-span-2`

### 2. Transaction detail client
- Replace `primaryAction` + `overflowMenu` with `azioniCard`
- Pass `layout="two-column"`

### 3. Tests
- Shell: two-column grid classes + azioniCard placement
- Page: visible actions, no overflow menu aria-label
