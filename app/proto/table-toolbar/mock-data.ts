// PROTOTYPE — wipe me. In-memory mock transactions for the toolbar prototype.
// Amounts are plain numbers here ON PURPOSE: this is throwaway display-only code, no money math.
// (Production uses Decimal.js — see CLAUDE.md.)

export type Row = {
  id: string
  description: string
  amount: number // negative = out, positive = in, ~0/transfer flagged separately
  date: string // ISO yyyy-mm-dd (occurredAt)
  category: string
  subcategory: string
  platform: string
  categorized: boolean
  isTransfer: boolean
}

const PLATFORMS = ['Intesa SP', 'Revolut', 'Fineco', 'Satispay'] as const

function r(
  id: number,
  description: string,
  amount: number,
  date: string,
  category: string,
  subcategory: string,
  platform: string,
  categorized: boolean,
  isTransfer = false,
): Row {
  return { id: `t${id}`, description, amount, date, category, subcategory, platform, categorized, isTransfer }
}

// ~36 rows across Feb–Jun 2026, mixed sign, a few transfers, some uncategorized.
export const MOCK_ROWS: Row[] = [
  r(1, 'ESSELUNGA MILANO VIA RIPA', -64.32, '2026-06-02', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(2, 'NETFLIX.COM', -12.99, '2026-06-01', 'Abbonamenti', 'Streaming', 'Revolut', true),
  r(3, 'BAR CENTRALE', -1.5, '2026-05-30', 'Alimentari & Ristorazione', 'Caffè & Bar', 'Satispay', true),
  r(4, 'BAR CENTRALE', -1.5, '2026-05-28', 'Alimentari & Ristorazione', 'Caffè & Bar', 'Satispay', true),
  r(5, 'BAR CENTRALE', -1.5, '2026-05-22', 'Alimentari & Ristorazione', 'Caffè & Bar', 'Satispay', true),
  r(6, 'STIPENDIO ACME SRL', 2450.0, '2026-05-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(7, 'AMAZON EU SARL', -38.9, '2026-05-26', 'Shopping', 'E-commerce', 'Revolut', false),
  r(8, 'TRENITALIA', -29.0, '2026-05-24', 'Trasporti', 'Treno', 'Fineco', true),
  r(9, 'GIROCONTO INTESA→REVOLUT', -300.0, '2026-05-20', 'Trasferimenti', 'Trasferimento tra conti', 'Intesa SP', true, true),
  r(10, 'RICARICA REVOLUT', 300.0, '2026-05-20', 'Trasferimenti', 'Trasferimento tra conti', 'Revolut', true, true),
  r(11, 'IKEA CORSICO', -149.95, '2026-05-18', 'Casa', 'Arredamento', 'Intesa SP', false),
  r(12, 'FARMACIA SAN PAOLO', -23.4, '2026-05-15', 'Salute', 'Farmacia', 'Satispay', true),
  r(13, 'SPOTIFY', -10.99, '2026-05-12', 'Abbonamenti', 'Streaming', 'Revolut', true),
  r(14, 'ENEL ENERGIA', -78.21, '2026-05-10', 'Casa', 'Bollette', 'Intesa SP', true),
  r(15, 'ESSELUNGA MILANO VIA RIPA', -52.18, '2026-05-08', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(16, 'PRELIEVO ATM', -100.0, '2026-05-05', 'Trasferimenti', 'Prelievo contante', 'Intesa SP', true, true),
  r(17, 'RISTORANTE DA MARIO', -56.0, '2026-05-03', 'Alimentari & Ristorazione', 'Ristoranti', 'Revolut', false),
  r(18, 'STIPENDIO ACME SRL', 2450.0, '2026-04-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(19, 'AMAZON EU SARL', -19.99, '2026-04-25', 'Shopping', 'E-commerce', 'Revolut', true),
  r(20, 'DECATHLON', -42.5, '2026-04-22', 'Shopping', 'Sport', 'Fineco', false),
  r(21, 'BAR CENTRALE', -1.5, '2026-04-20', 'Alimentari & Ristorazione', 'Caffè & Bar', 'Satispay', true),
  r(22, 'NETFLIX.COM', -12.99, '2026-04-18', 'Abbonamenti', 'Streaming', 'Revolut', true),
  r(23, 'ENEL ENERGIA', -81.04, '2026-04-10', 'Casa', 'Bollette', 'Intesa SP', true),
  r(24, 'ESSELUNGA MILANO VIA RIPA', -71.6, '2026-04-06', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(25, 'RIMBORSO IRPEF', 340.5, '2026-04-04', 'Rimborsi, cashback e bonus', 'Rimborso fiscale', 'Intesa SP', false),
  r(26, 'GIROCONTO INTESA→FINECO', -500.0, '2026-04-02', 'Trasferimenti', 'Trasferimento tra conti', 'Intesa SP', true, true),
  r(27, 'STIPENDIO ACME SRL', 2450.0, '2026-03-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(28, 'BOOKING.COM', -212.0, '2026-03-21', 'Viaggi', 'Hotel', 'Revolut', false),
  r(29, 'RYANAIR', -89.99, '2026-03-19', 'Viaggi', 'Voli', 'Revolut', true),
  r(30, 'SPOTIFY', -10.99, '2026-03-12', 'Abbonamenti', 'Streaming', 'Revolut', true),
  r(31, 'ENEL ENERGIA', -76.5, '2026-03-10', 'Casa', 'Bollette', 'Intesa SP', true),
  r(32, 'ESSELUNGA MILANO VIA RIPA', -49.9, '2026-03-05', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(33, 'CASHBACK REVOLUT', 4.2, '2026-03-03', 'Rimborsi, cashback e bonus', 'Cashback carta di credito', 'Revolut', true),
  r(34, 'AMAZON EU SARL', -120.0, '2026-02-26', 'Shopping', 'E-commerce', 'Revolut', false),
  r(35, 'BAR CENTRALE', -1.5, '2026-02-20', 'Alimentari & Ristorazione', 'Caffè & Bar', 'Satispay', true),
  r(36, 'ENEL ENERGIA', -79.8, '2026-02-10', 'Casa', 'Bollette', 'Intesa SP', true),
  // ---- 2025 (con buchi: niente Mar/Giu/Ago/Nov) ----
  r(37, 'STIPENDIO ACME SRL', 2380.0, '2025-12-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(38, 'AMAZON EU SARL', -64.0, '2025-12-15', 'Shopping', 'E-commerce', 'Revolut', true),
  r(39, 'ESSELUNGA MILANO VIA RIPA', -58.2, '2025-12-03', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(40, 'ENEL ENERGIA', -72.1, '2025-10-10', 'Casa', 'Bollette', 'Intesa SP', true),
  r(41, 'NETFLIX.COM', -11.99, '2025-10-04', 'Abbonamenti', 'Streaming', 'Revolut', true),
  r(42, 'RYANAIR', -54.99, '2025-09-22', 'Viaggi', 'Voli', 'Revolut', false),
  r(43, 'BOOKING.COM', -180.0, '2025-09-12', 'Viaggi', 'Hotel', 'Revolut', true),
  r(44, 'STIPENDIO ACME SRL', 2380.0, '2025-07-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(45, 'IKEA CORSICO', -88.5, '2025-07-09', 'Casa', 'Arredamento', 'Intesa SP', true),
  r(46, 'ESSELUNGA MILANO VIA RIPA', -61.4, '2025-05-18', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(47, 'GIROCONTO INTESA→REVOLUT', -250.0, '2025-05-06', 'Trasferimenti', 'Trasferimento tra conti', 'Intesa SP', true, true),
  r(48, 'SPOTIFY', -9.99, '2025-04-12', 'Abbonamenti', 'Streaming', 'Revolut', true),
  r(49, 'FARMACIA SAN PAOLO', -14.2, '2025-04-03', 'Salute', 'Farmacia', 'Satispay', true),
  r(50, 'ENEL ENERGIA', -83.0, '2025-02-10', 'Casa', 'Bollette', 'Intesa SP', true),
  r(51, 'STIPENDIO ACME SRL', 2300.0, '2025-01-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(52, 'AMAZON EU SARL', -27.5, '2025-01-14', 'Shopping', 'E-commerce', 'Revolut', false),
  // ---- 2024 (sparso: solo Mar/Apr/Set/Nov/Dic) ----
  r(53, 'STIPENDIO ACME SRL', 2250.0, '2024-12-27', 'Stipendio', 'Stipendio netto', 'Intesa SP', true),
  r(54, 'AMAZON EU SARL', -99.9, '2024-12-10', 'Shopping', 'E-commerce', 'Revolut', true),
  r(55, 'ENEL ENERGIA', -70.0, '2024-11-10', 'Casa', 'Bollette', 'Intesa SP', true),
  r(56, 'BOOKING.COM', -320.0, '2024-09-18', 'Viaggi', 'Hotel', 'Revolut', false),
  r(57, 'RYANAIR', -120.0, '2024-09-05', 'Viaggi', 'Voli', 'Revolut', true),
  r(58, 'ESSELUNGA MILANO VIA RIPA', -47.3, '2024-04-16', 'Alimentari & Ristorazione', 'Spesa supermercato', 'Intesa SP', true),
  r(59, 'IKEA CORSICO', -210.0, '2024-03-22', 'Casa', 'Arredamento', 'Intesa SP', false),
  r(60, 'NETFLIX.COM', -10.99, '2024-03-04', 'Abbonamenti', 'Streaming', 'Revolut', true),
]

export const ALL_CATEGORIES = Array.from(new Set(MOCK_ROWS.map((x) => x.category))).sort()
export const ALL_PLATFORMS = [...PLATFORMS]
export const ALL_MONTHS = Array.from(new Set(MOCK_ROWS.map((x) => x.date.slice(0, 7)))).sort().reverse() // 'YYYY-MM' desc
