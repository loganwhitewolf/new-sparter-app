'use client'

// PROTOTYPE — Variante B: Full-screen hero, grandi numeri, progress dots in fondo.
// Struttura radicalmente diversa da A: ogni step occupa l'intera viewport.
// Elimina insieme al resto del prototipo dopo la validazione.

import { useState } from 'react'
import { CloudUpload, CheckCircle, ArrowRight, ChevronRight } from 'lucide-react'
import { MOCK_FILE, MOCK_UNCATEGORIZED, CATEGORIES, NATURE_LABEL, formatAmount } from './mock-data'

const STEP_NAMES: Record<number, string> = {
  1: 'Carica il file',
  2: 'Riepilogo',
  3: 'Come funziona',
  4: 'Categorizzazione',
  5: 'Completato',
}

function Dots({ current, dark = true }: { current: number; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5 items-center">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${dark
              ? i < current ? 'h-1.5 w-1.5 bg-white/50' : i === current ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 bg-white/20'
              : i < current ? 'h-1.5 w-1.5 bg-gray-400' : i === current ? 'h-2 w-2 bg-gray-900' : 'h-1.5 w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${dark ? 'text-white/60' : 'text-gray-500'}`}>
        {STEP_NAMES[current]}
      </span>
    </div>
  )
}

export function VariantB() {
  const [step, setStep] = useState(1)
  const [categorized, setCategorized] = useState<Record<number, string>>({})
  const next = () => setStep(s => s + 1)
  const pct = Math.round((MOCK_FILE.autoCategorized / MOCK_FILE.transactions) * 100)
  const catCount = Object.keys(categorized).length

  const bgMap: Record<number, string> = {
    1: 'from-slate-800 to-slate-900',
    2: 'from-slate-700 to-slate-800',
    3: 'from-slate-700 to-slate-800',
    4: 'from-white to-gray-50',
    5: 'from-green-600 to-green-700',
  }

  const isDark = step !== 4

  return (
    <div className={`fixed inset-0 z-50 bg-gradient-to-br ${bgMap[step]} overflow-y-auto`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 pt-6 pb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        <span className={`text-sm font-semibold tracking-wide ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Sparter</span>
        <Dots current={step} dark={isDark} />
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-white text-center">
          <CloudUpload className="h-16 w-16 text-white/30 mb-6" />
          <h1 className="text-4xl font-bold mb-3">Il tuo primo estratto conto</h1>
          <p className="text-white/60 text-base max-w-sm mb-12">
            Carica il file della tua banca e vedremo insieme dove vanno i tuoi soldi.
          </p>
          <div
            onClick={() => setTimeout(next, 200)}
            className="w-full max-w-sm border-2 border-dashed border-white/20 rounded-2xl p-10 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-colors flex flex-col items-center gap-3 mb-4"
          >
            <p className="text-sm font-medium text-white/80">Trascina qui il tuo file</p>
            <p className="text-xs text-white/40">oppure clicca per sfogliare</p>
          </div>
          <p className="text-xs text-white/30">CSV, XLS, XLSX · max 10 MB</p>
        </div>
      )}

      {/* Step 2 — Overview */}
      {step === 2 && (
        <div className="flex flex-col min-h-[calc(100vh-80px)] px-6 pt-4 pb-24 text-white">
          <div className="flex items-center gap-2 mb-10">
            <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            <span className="text-sm text-white/50 truncate">{MOCK_FILE.fileName}</span>
          </div>
          <p className="text-white/50 text-sm uppercase tracking-widest mb-2">Il tuo estratto</p>
          <div className="text-7xl font-black mb-1">{MOCK_FILE.transactions}</div>
          <p className="text-white/60 text-lg mb-10">transazioni importate</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl bg-white/10 p-5">
              <div className="text-2xl font-bold text-green-400">+€{MOCK_FILE.income.toLocaleString('it-IT')}</div>
              <div className="text-xs text-white/50 mt-1">entrate</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <div className="text-2xl font-bold text-red-400">−€{MOCK_FILE.expenses.toLocaleString('it-IT')}</div>
              <div className="text-xs text-white/50 mt-1">uscite</div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-5 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/70">{MOCK_FILE.autoCategorized} di {MOCK_FILE.transactions} già categorizzate</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-2 bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <p className="text-xs text-white/30 mb-10">{MOCK_FILE.months}</p>
        </div>
      )}

      {/* Step 3 — Education */}
      {step === 3 && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-white text-center">
          <div className="text-7xl font-black mb-2">{MOCK_FILE.uncategorized}</div>
          <p className="text-white/60 text-xl mb-2">transazioni da categorizzare</p>
          <p className="text-white/40 text-sm max-w-xs mb-12">
            Le altre {MOCK_FILE.autoCategorized} erano già note. Ci vogliono solo pochi tocchi.
          </p>
          <div className="w-full max-w-sm rounded-2xl bg-white/10 border border-white/10 p-5 text-left mb-10">
            <div className="flex gap-3">
              <span className="text-lg">💡</span>
              <p className="text-sm text-white/70 leading-relaxed">
                I trasferimenti tra conti e i giroconti vengono esclusi dai totali in dashboard — è normale se i numeri sembrano diversi da quelli che ti aspetti.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Categorizzazione (light) */}
      {step === 4 && (
        <div className="flex flex-col min-h-[calc(100vh-80px)] px-4 pt-2 pb-28 text-gray-900">
          <div className="mb-5">
            <h1 className="text-2xl font-bold mb-1">Categorizza le spese principali</h1>
            <p className="text-sm text-gray-500">Le 15 con il valore più alto · {catCount > 0 ? `${catCount} assegnate` : 'nessuna ancora'}</p>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[60vh]">
            {MOCK_UNCATEGORIZED.map(tx => (
              <div key={tx.id} className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900 flex-1 pr-2">{tx.title}</p>
                  <p className={`text-sm font-bold shrink-0 ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(tx.amount)}
                  </p>
                </div>
                <select
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-700 cursor-pointer"
                  value={categorized[tx.id] ?? ''}
                  onChange={e => setCategorized(prev => ({ ...prev, [tx.id]: e.target.value }))}
                >
                  <option value="">Seleziona categoria...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label} · {NATURE_LABEL[cat.nature]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 5 — Outro */}
      {step === 5 && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-white text-center">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-white/20 mb-8">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Benvenuto in Sparter!</h1>
          <p className="text-white/70 text-base max-w-xs mb-12">
            Il tuo primo estratto è pronto. Cosa vuoi fare adesso?
          </p>
          <div className="w-full max-w-sm space-y-3">
            <a href="/dashboard" className="flex items-center justify-center gap-2 w-full bg-white text-gray-900 rounded-2xl py-4 text-sm font-semibold hover:bg-white/90 transition-colors">
              Vai alla dashboard <ChevronRight className="h-4 w-4" />
            </a>
            <a href="/settings/categories" className="block w-full text-white/80 rounded-2xl py-4 text-sm border border-white/20 hover:bg-white/10 transition-colors text-center">
              Personalizza le categorie
            </a>
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      {step !== 1 && step !== 5 && (
        <div className={`fixed bottom-0 left-0 right-0 p-4 ${step === 4 ? 'bg-white border-t border-gray-100' : ''}`}>
          <div className="flex gap-3 max-w-xl mx-auto">
            {step === 4 && (
              <button onClick={next} className="flex-1 text-sm text-gray-400 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                Categorizza il resto dopo
              </button>
            )}
            <button
              onClick={next}
              className={`flex-1 rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                step === 4
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-white text-gray-900 hover:bg-white/90'
              }`}
            >
              {step === 2 ? 'Continua a categorizzare' : step === 3 ? 'Inizia la categorizzazione' : 'Continua'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
