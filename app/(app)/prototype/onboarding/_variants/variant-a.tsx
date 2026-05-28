'use client'

// PROTOTYPE — Variante A: Card minimalista centrata, step singolo per volta.
// Elimina insieme al resto del prototipo dopo la validazione.

import { useState } from 'react'
import { CheckCircle, CloudUpload, Info, ArrowRight } from 'lucide-react'
import { MOCK_FILE, MOCK_UNCATEGORIZED, CATEGORIES, NATURE_LABEL, NATURE_CLASS, formatAmount } from './mock-data'

function StepBar({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>Step {current} di 5</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-1 bg-gray-900 rounded-full transition-all duration-300"
          style={{ width: `${(current / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}

export function VariantA() {
  const [step, setStep] = useState(1)
  const [categorized, setCategorized] = useState<Record<number, string>>({})
  const next = () => setStep(s => s + 1)
  const pct = Math.round((MOCK_FILE.autoCategorized / MOCK_FILE.transactions) * 100)

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto flex items-start justify-center py-10 px-4">
      <div className={`w-full ${step === 4 ? 'max-w-xl' : 'max-w-md'} bg-white rounded-2xl shadow-sm border border-gray-100 p-8`}>

        {step === 1 && (
          <>
            <StepBar current={1} />
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Carica il tuo estratto conto</h1>
            <p className="text-sm text-gray-500 mb-8">
              Supportiamo CSV ed Excel di Intesa SP, Fineco, Revolut, Satispay e altre banche italiane.
              Se la tua banca non viene riconosciuta ti aiutiamo a configurarla.
            </p>
            <div
              onClick={() => setTimeout(next, 200)}
              className="border-2 border-dashed border-gray-200 rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <CloudUpload className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Trascina qui il tuo file</p>
              <p className="text-xs text-gray-400">oppure clicca per sfogliare</p>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">CSV, XLS, XLSX · max 10 MB</p>
          </>
        )}

        {step === 2 && (
          <>
            <StepBar current={2} />
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-xs text-gray-400 truncate">{MOCK_FILE.fileName}</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Estratto caricato</h1>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-xl font-bold text-gray-900">{MOCK_FILE.transactions}</div>
                <div className="text-xs text-gray-500 mt-0.5">transazioni</div>
              </div>
              <div className="rounded-xl bg-green-50 p-4 text-center">
                <div className="text-xl font-bold text-green-700">+€{MOCK_FILE.income.toLocaleString('it-IT')}</div>
                <div className="text-xs text-gray-500 mt-0.5">entrate</div>
              </div>
              <div className="rounded-xl bg-red-50 p-4 text-center">
                <div className="text-xl font-bold text-red-600">−€{MOCK_FILE.expenses.toLocaleString('it-IT')}</div>
                <div className="text-xs text-gray-500 mt-0.5">uscite</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-5">{MOCK_FILE.months}</p>
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600">{MOCK_FILE.autoCategorized} di {MOCK_FILE.transactions} già categorizzate</span>
                <span className="font-semibold text-gray-900">{pct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button onClick={next} className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              Continua a categorizzare <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <StepBar current={3} />
            <div className="flex justify-center mb-6">
              <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Info className="h-7 w-7 text-gray-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2 text-center">Alcune transazioni hanno bisogno di te</h1>
            <p className="text-sm text-gray-500 mb-6 text-center">
              {MOCK_FILE.uncategorized} transazioni non sono state riconosciute automaticamente.
              Le categorizzeremo insieme in pochi passaggi.
            </p>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 mb-8 flex gap-3">
              <span className="text-base shrink-0">💡</span>
              <p className="text-sm text-amber-900">
                <strong>Nota sui trasferimenti:</strong> giroconti e trasferimenti tra tuoi conti non contano come spese nella dashboard — è normale se i totali sembrano più bassi.
              </p>
            </div>
            <button onClick={next} className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              Inizia <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <StepBar current={4} />
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Categorizza le spese principali</h1>
            <p className="text-sm text-gray-500 mb-5">Le 15 transazioni con il valore più alto</p>
            <div className="space-y-2 mb-6 max-h-[52vh] overflow-y-auto pr-1">
              {MOCK_UNCATEGORIZED.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tx.title}</p>
                    <p className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatAmount(tx.amount)}
                    </p>
                  </div>
                  <select
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 w-44 cursor-pointer shrink-0"
                    value={categorized[tx.id] ?? ''}
                    onChange={e => setCategorized(prev => ({ ...prev, [tx.id]: e.target.value }))}
                  >
                    <option value="">Seleziona...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} · {NATURE_LABEL[cat.nature]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={next} className="flex-1 text-sm text-gray-500 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                Categorizza il resto dopo
              </button>
              {Object.keys(categorized).length > 0 && (
                <button onClick={next} className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                  Continua <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}

        {step === 5 && (
          <div className="text-center py-4">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-50 mb-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Ottimo!</h1>
            <p className="text-sm text-gray-500 mb-8">
              Il tuo primo estratto è pronto. Puoi ora esplorare la dashboard o personalizzare le tue categorie.
            </p>
            <div className="space-y-3">
              <a href="/dashboard" className="block w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors text-center">
                Vai alla dashboard →
              </a>
              <a href="/settings/categories" className="block w-full text-gray-600 rounded-xl py-3 text-sm border border-gray-200 hover:bg-gray-50 transition-colors text-center">
                Personalizza le categorie
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
