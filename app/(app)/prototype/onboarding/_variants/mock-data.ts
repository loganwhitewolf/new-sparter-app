// PROTOTYPE — dati fittizi per validare il flusso onboarding. Eliminare con il prototipo.

export const MOCK_FILE = {
  fileName: 'estratto_intesa_maggio.xlsx',
  transactions: 87,
  income: 3200,
  expenses: 2150,
  months: 'Apr–Mag 2026',
  autoCategorized: 62,
  uncategorized: 25,
}

export const MOCK_UNCATEGORIZED = [
  { id: 1, title: 'AFFITTO MAGGIO 2026', amount: -750.00 },
  { id: 2, title: 'STIPENDIO MAGGIO 2026', amount: 2800.00 },
  { id: 3, title: 'ESSELUNGA SPA', amount: -342.50 },
  { id: 4, title: 'MEDIAWORLD', amount: -245.00 },
  { id: 5, title: 'AMAZON EU SARL', amount: -89.99 },
  { id: 6, title: 'ENI GAS E LUCE', amount: -84.00 },
  { id: 7, title: 'CARREFOUR', amount: -67.30 },
  { id: 8, title: 'TELEPASS SPA', amount: -35.00 },
  { id: 9, title: 'PALESTRA FITNESS', amount: -39.00 },
  { id: 10, title: 'NETFLIX', amount: -15.99 },
  { id: 11, title: 'FARMACIA CENTRALE', amount: -22.50 },
  { id: 12, title: 'AUTOGRILL', amount: -12.80 },
  { id: 13, title: 'BAR CENTRALE', amount: -4.50 },
  { id: 14, title: 'TABACCHERIA SPORT', amount: -8.00 },
  { id: 15, title: 'PARCHEGGIO MILAN', amount: -6.00 },
]

export const CATEGORIES = [
  { value: 'casa-affitto', label: 'Casa › Affitto', nature: 'essential' },
  { value: 'reddito-stipendio', label: 'Reddito › Stipendio', nature: 'operational' },
  { value: 'alimentari-supermercato', label: 'Alimentari › Supermercato', nature: 'essential' },
  { value: 'shopping-elettronica', label: 'Shopping › Elettronica', nature: 'discretionary' },
  { value: 'shopping-online', label: 'Shopping › Online', nature: 'discretionary' },
  { value: 'casa-bollette', label: 'Casa › Bollette', nature: 'essential' },
  { value: 'alimentari-ristorante', label: 'Alimentari › Ristorazione', nature: 'discretionary' },
  { value: 'trasporti-pedaggi', label: 'Trasporti › Carburante & Pedaggi', nature: 'essential' },
  { value: 'sport-palestra', label: 'Sport › Palestra & Fitness', nature: 'discretionary' },
  { value: 'intrattenimento-streaming', label: 'Intrattenimento › Streaming', nature: 'discretionary' },
  { value: 'salute-farmacia', label: 'Salute › Farmacia', nature: 'essential' },
  { value: 'alimentari-bar', label: 'Alimentari › Caffè & Bar', nature: 'discretionary' },
  { value: 'trasporti-parcheggio', label: 'Trasporti › Parcheggio', nature: 'essential' },
]

export const NATURE_LABEL: Record<string, string> = {
  essential: 'essenziale',
  discretionary: 'discrezionale',
  operational: 'operativo',
  financial: 'finanziario',
}

export const NATURE_CLASS: Record<string, string> = {
  essential: 'bg-blue-100 text-blue-700',
  discretionary: 'bg-orange-100 text-orange-700',
  operational: 'bg-green-100 text-green-700',
  financial: 'bg-purple-100 text-purple-700',
}

export function formatAmount(amount: number) {
  const abs = Math.abs(amount).toFixed(2).replace('.', ',')
  return `${amount >= 0 ? '+' : '−'}€${abs}`
}
