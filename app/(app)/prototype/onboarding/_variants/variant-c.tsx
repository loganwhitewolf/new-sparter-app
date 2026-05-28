'use client'

// PROTOTYPE — Variante C: Sidebar wizard con checklist degli step visibile.
// Struttura B2B/config-wizard. Sidebar sinistra = roadmap del processo.
// Elimina insieme al resto del prototipo dopo la validazione.

import { useState } from 'react'
import { Check, CloudUpload, CheckCircle, ArrowRight, ChevronRight } from 'lucide-react'
import { MOCK_FILE, MOCK_UNCATEGORIZED, CATEGORIES, NATURE_LABEL, NATURE_CLASS, formatAmount } from './mock-data'

const STEPS = [
  { id: 1, label: 'Carica il file' },
  { id: 2, label: 'Riepilogo' },
  { id: 3, label: 'Come funziona' },
  { id: 4, label: 'Categorizzazione' },
  { id: 5, label: 'Completato' },
]

function Sidebar({ current }: { current: number }) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 bg-gray-900 flex-col">
      <div className="px-6 pt-8 pb-10">
        <span className="text-white font-semibold text-base tracking-wide">Sparter</span>
        <p className="text-white/40 text-xs mt-1">Configurazione iniziale</p>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {STEPS.map(s => {
          const done = s.id < current
          const active = s.id === current
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'bg-white/10 text-white font-medium' :
                done ? 'text-white/50' :
                'text-white/25'
              }`}
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-xs border ${
                done ? 'bg-green-500 border-green-500' :
                active ? 'border-white bg-white/10' :
                'border-white/20'
              }`}>
                {done ? <Check className="h-3 w-3 text-white" /> : <span className="text-white/50">{s.id}</span>}
              </div>
              {s.label}
            </div>
          )
        })}
      </nav>
      <div className="px-6 pb-6 text-xs text-white/20">
        Passo {current} di 5
      </div>
    </aside>
  )
}

function MobileProgress({ current }: { current: number }) {
  return (
    <div className="md:hidden bg-gray-900 px-4 py-3 flex items-center gap-3">
      <span className="text-white font-semibold text-sm">Sparter</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-1 bg-white/60 rounded-full transition-all" style={{ width: `${(current / 5) * 100}%` }} />
      </div>
      <span className="text-white/40 text-xs">{current}/5</span>
    </div>
  )
}

export function VariantC() {
  const [step, setStep] = useState(1)
  const [categorized, setCategorized] = useState<Record<number, string>>({})
  const next = () => setStep(s => s + 1)
  const pct = Math.round((MOCK_FILE.autoCategorized / MOCK_FILE.transactions) * 100)

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      <Sidebar current={step} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <MobileProgress current={step} />
        <main className="flex-1 overflow-y-auto bg-white p-8">

          {/* Step 1 */}
          {step === 1 && (
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Passo 1 di 5</p>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Carica il tuo estratto conto</h1>
              <p className="text-sm text-gray-500 mb-8">
                Supportiamo i formati di Intesa SP, Fineco, Revolut, Satispay e altre banche.
                Se la tua banca non viene rilevata ti guidiamo nella configurazione.
              </p>
              <div
                onClick={() => setTimeout(next, 200)}
                className="border-2 border-dashed border-gray-200 rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <CloudUpload className="h-8 w-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Trascina qui il tuo file</p>
                <p className="text-xs text-gray-400">oppure clicca per sfogliare</p>
              </div>
              <p className="text-xs text-gray-400 mt-3">CSV, XLS, XLSX · max 10 MB</p>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Passo 2 di 5</p>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-400">{MOCK_FILE.fileName}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-6">Riepilogo file</h1>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                <div className="flex justify-between px-5 py-3.5">
                  <span className="text-sm text-gray-500">Transazioni importate</span>
                  <span className="text-sm font-semibold text-gray-900">{MOCK_FILE.transactions}</span>
                </div>
                <div className="flex justify-between px-5 py-3.5">
                  <span className="text-sm text-gray-500">Entrate totali</span>
                  <span className="text-sm font-semibold text-green-700">+€{MOCK_FILE.income.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between px-5 py-3.5">
                  <span className="text-sm text-gray-500">Uscite totali</span>
                  <span className="text-sm font-semibold text-red-600">−€{MOCK_FILE.expenses.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between px-5 py-3.5">
                  <span className="text-sm text-gray-500">Periodo</span>
                  <span className="text-sm font-medium text-gray-900">{MOCK_FILE.months}</span>
                </div>
                <div className="px-5 py-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Auto-categorizzate</span>
                    <span className="font-semibold text-gray-900">{MOCK_FILE.autoCategorized} di {MOCK_FILE.transactions} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              <button onClick={next} className="mt-6 flex items-center gap-2 bg-gray-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
                Continua <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Passo 3 di 5</p>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Come funziona la categorizzazione</h1>
              <p className="text-sm text-gray-500 mb-6">
                Sparter ha già classificato automaticamente {MOCK_FILE.autoCategorized} transazioni usando le sue regole.
                Le restanti {MOCK_FILE.uncategorized} richiedono la tua scelta.
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg shrink-0">⚡</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Categorizzazione automatica</p>
                    <p className="text-sm text-gray-500 mt-0.5">Usa regole di riconoscimento predefinite (es. "Netflix" → Intrattenimento). Si aggiorna nel tempo imparando dai tuoi dati.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg shrink-0">✏️</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Categorizzazione manuale</p>
                    <p className="text-sm text-gray-500 mt-0.5">Per le transazioni non riconosciute assegni tu categoria e sottocategoria. Puoi farlo ora o in un secondo momento.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-lg shrink-0">💡</span>
                  <div>
                    <p className="text-sm font-medium text-amber-900">Trasferimenti e giroconti</p>
                    <p className="text-sm text-amber-700 mt-0.5">Non vengono contati come spese in dashboard. Se i totali sembrano diversi da quelli attesi, è normale.</p>
                  </div>
                </div>
              </div>
              <button onClick={next} className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
                Inizia la categorizzazione <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Passo 4 di 5</p>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Categorizzazione</h1>
              <p className="text-sm text-gray-500 mb-6">
                Le 15 transazioni con il valore più alto · {Object.keys(categorized).length > 0 ? `${Object.keys(categorized).length} assegnate` : 'nessuna ancora'}
              </p>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1 mb-6">
                {MOCK_UNCATEGORIZED.map(tx => {
                  const catValue = categorized[tx.id]
                  const cat = CATEGORIES.find(c => c.value === catValue)
                  return (
                    <div key={tx.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${catValue ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatAmount(tx.amount)}
                          </p>
                          {cat && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${NATURE_CLASS[cat.nature]}`}>
                              {NATURE_LABEL[cat.nature]}
                            </span>
                          )}
                        </div>
                      </div>
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 w-48 cursor-pointer shrink-0"
                        value={catValue ?? ''}
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
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={next} className="text-sm text-gray-400 px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  Categorizza il resto dopo
                </button>
                {Object.keys(categorized).length > 0 && (
                  <button onClick={next} className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors">
                    Continua <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 5 */}
          {step === 5 && (
            <div className="max-w-md flex flex-col items-start">
              <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Configurazione completata</p>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Tutto pronto!</h1>
              <p className="text-sm text-gray-500 mb-8">
                Il tuo primo estratto conto è stato importato e categorizzato.
                Ora puoi esplorare la dashboard o personalizzare le categorie per adattarle al tuo modo di tenere i conti.
              </p>
              <div className="space-y-3 w-full">
                <a href="/dashboard" className="flex items-center justify-between w-full bg-gray-900 text-white rounded-xl px-5 py-3.5 text-sm font-medium hover:bg-gray-800 transition-colors">
                  <span>Vai alla dashboard</span>
                  <ChevronRight className="h-4 w-4" />
                </a>
                <a href="/settings/categories" className="flex items-center justify-between w-full border border-gray-200 text-gray-700 rounded-xl px-5 py-3.5 text-sm hover:bg-gray-50 transition-colors">
                  <span>Personalizza le categorie</span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
