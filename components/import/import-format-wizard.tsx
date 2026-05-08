'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createPrivateImportFormatAction,
  type ImportActionState,
} from '@/lib/actions/import'
import type {
  CreatePrivateImportFormatResult,
  ImportFormatWizardContext,
} from '@/lib/services/import-format-wizard'
import { APP_ROUTES } from '@/lib/routes'

const MAX_HEADER_OPTIONS = 80
const DEFAULT_DELIMITERS = [
  { value: ',', label: 'Virgola (,)' },
  { value: ';', label: 'Punto e virgola (;)' },
  { value: '\t', label: 'Tabulazione' },
  { value: '|', label: 'Barra verticale (|)' },
] as const

type AmountMode = 'single' | 'separate'
type WizardFieldValues = {
  platformName: string
  delimiter: string
  timestampColumn: string
  descriptionColumn: string
  amountMode: string
  amountColumn: string
  positiveAmountColumn: string
  negativeAmountColumn: string
}

type Props = {
  context: ImportFormatWizardContext
  createAction?: typeof createPrivateImportFormatAction
}

function emptyState(): ImportActionState<CreatePrivateImportFormatResult> {
  return { error: null }
}

function isAmountMode(value: string): value is AmountMode {
  return value === 'single' || value === 'separate'
}

export function getVisibleHeaderOptions(headers: readonly string[]) {
  return headers.slice(0, MAX_HEADER_OPTIONS)
}

export function validateWizardFields(values: WizardFieldValues, headers: readonly string[]) {
  const errors: string[] = []
  const availableHeaders = new Set(headers)
  const requiredColumns = [values.timestampColumn, values.descriptionColumn]

  if (!values.platformName.trim()) errors.push('Inserisci il nome della piattaforma.')
  if (!values.delimiter) errors.push('Seleziona il separatore del file.')
  if (!values.timestampColumn) errors.push('Seleziona la colonna della data.')
  if (!values.descriptionColumn) errors.push('Seleziona la colonna della descrizione.')

  if (!isAmountMode(values.amountMode)) {
    errors.push('Seleziona una modalità importo valida.')
  } else if (values.amountMode === 'single') {
    if (!values.amountColumn) errors.push('Seleziona la colonna dell’importo.')
    requiredColumns.push(values.amountColumn)
  } else {
    if (!values.positiveAmountColumn || !values.negativeAmountColumn) {
      errors.push('Seleziona le colonne degli importi in entrata e in uscita.')
    }
    requiredColumns.push(values.positiveAmountColumn, values.negativeAmountColumn)
  }

  const chosenColumns = requiredColumns.filter(Boolean)
  const unknownColumn = chosenColumns.find((column) => !availableHeaders.has(column))
  if (unknownColumn) errors.push('Una colonna selezionata non è più disponibile nel file.')

  const duplicateColumns = new Set<string>()
  const seenColumns = new Set<string>()
  for (const column of chosenColumns) {
    if (seenColumns.has(column)) duplicateColumns.add(column)
    seenColumns.add(column)
  }
  if (duplicateColumns.size > 0) {
    errors.push('Usa colonne diverse per data, descrizione e importi.')
  }

  return errors
}

function readFormValues(form: HTMLFormElement): WizardFieldValues {
  const data = new FormData(form)
  const get = (key: string) => {
    const value = data.get(key)
    return typeof value === 'string' ? value : ''
  }

  return {
    platformName: get('platformName'),
    delimiter: get('delimiter'),
    timestampColumn: get('timestampColumn'),
    descriptionColumn: get('descriptionColumn'),
    amountMode: get('amountMode'),
    amountColumn: get('amountColumn'),
    positiveAmountColumn: get('positiveAmountColumn'),
    negativeAmountColumn: get('negativeAmountColumn'),
  }
}

export function ImportFormatWizard({
  context,
  createAction = createPrivateImportFormatAction,
}: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createAction, emptyState())
  const [amountMode, setAmountMode] = useState<AmountMode>('single')
  const [clientErrors, setClientErrors] = useState<string[]>([])
  const headerOptions = useMemo(() => getVisibleHeaderOptions(context.headers), [context.headers])
  const hasHeaders = headerOptions.length > 0
  const truncatedHeaders = context.headers.length > headerOptions.length
  const createdFormatVersionId = state.data?.formatVersionId

  useEffect(() => {
    if (createdFormatVersionId) {
      router.push(
        `/import/${encodeURIComponent(context.fileId)}/analyze?formatVersionId=${encodeURIComponent(
          String(createdFormatVersionId),
        )}`,
      )
    }
  }, [context.fileId, createdFormatVersionId, router])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors = validateWizardFields(readFormValues(event.currentTarget), context.headers)
    setClientErrors(errors)
    if (errors.length > 0) {
      event.preventDefault()
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-background to-background shadow-sm">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Recupero formato
          </p>
          <CardTitle className="text-2xl">Configura un formato privato</CardTitle>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Useremo solo le intestazioni di <strong>{context.fileName}</strong> per creare una
            configurazione visibile soltanto al tuo account. Il file originale resta memorizzato e
            verrà rianalizzato appena salvi il formato.
          </p>
        </CardHeader>
        <CardContent>
          {!hasHeaders ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Non sono disponibili intestazioni sicure per questo file. Torna agli import e
                carica di nuovo il documento.
              </AlertDescription>
            </Alert>
          ) : (
            <form action={formAction} onSubmit={handleSubmit} className="space-y-6" noValidate>
              <input type="hidden" name="fileId" value={context.fileId} />

              {(clientErrors.length > 0 || state.error) && (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    {state.error ? (
                      <p>{state.error}</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-4">
                        {clientErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {createdFormatVersionId && (
                <Alert role="status" aria-live="polite">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Formato salvato. Riprovo l’analisi dello stesso file…
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="platformName" className="text-sm font-medium">
                    Nome piattaforma
                  </label>
                  <input
                    id="platformName"
                    name="platformName"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Es. Banca personale"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Questo nome resta privato e ti aiuta a riconoscere il formato in futuro.
                  </p>
                </div>

                <SelectField
                  id="delimiter"
                  label="Separatore"
                  name="delimiter"
                  defaultValue={context.detectedDelimiter ?? ';'}
                  options={DEFAULT_DELIMITERS}
                />
                <SelectField
                  id="timestampColumn"
                  label="Colonna data"
                  name="timestampColumn"
                  options={headerOptions.map((header) => ({ value: header, label: header }))}
                />
                <SelectField
                  id="descriptionColumn"
                  label="Colonna descrizione"
                  name="descriptionColumn"
                  options={headerOptions.map((header) => ({ value: header, label: header }))}
                />
              </div>

              <fieldset className="space-y-3 rounded-xl border bg-background/70 p-4">
                <legend className="px-1 text-sm font-semibold">Modalità importo</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 has-checked:border-primary has-checked:bg-primary/5">
                    <input
                      type="radio"
                      name="amountMode"
                      value="single"
                      checked={amountMode === 'single'}
                      onChange={() => setAmountMode('single')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">Una colonna importo</span>
                      <span className="text-muted-foreground">Valori positivi e negativi nella stessa colonna.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 has-checked:border-primary has-checked:bg-primary/5">
                    <input
                      type="radio"
                      name="amountMode"
                      value="separate"
                      checked={amountMode === 'separate'}
                      onChange={() => setAmountMode('separate')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">Entrate e uscite separate</span>
                      <span className="text-muted-foreground">Due colonne distinte per accrediti e addebiti.</span>
                    </span>
                  </label>
                </div>

                {amountMode === 'single' ? (
                  <SelectField
                    id="amountColumn"
                    label="Colonna importo"
                    name="amountColumn"
                    options={headerOptions.map((header) => ({ value: header, label: header }))}
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      id="positiveAmountColumn"
                      label="Colonna entrate"
                      name="positiveAmountColumn"
                      options={headerOptions.map((header) => ({ value: header, label: header }))}
                    />
                    <SelectField
                      id="negativeAmountColumn"
                      label="Colonna uscite"
                      name="negativeAmountColumn"
                      options={headerOptions.map((header) => ({ value: header, label: header }))}
                    />
                  </div>
                )}
              </fieldset>

              {truncatedHeaders && (
                <Alert>
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Il file contiene molte intestazioni: mostriamo le prime {MAX_HEADER_OPTIONS} per
                    mantenere il modulo utilizzabile senza leggere righe complete.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending || Boolean(createdFormatVersionId)} aria-busy={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Salva formato e riprova analisi
                </Button>
                <Button asChild variant="ghost">
                  <Link href={APP_ROUTES.import}>Torna agli import</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <aside className="space-y-4" aria-label="Intestazioni rilevate">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intestazioni sicure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sono mostrati solo i nomi delle colonne e un massimo di {context.sampleRows.length} righe campione già troncate.
            </p>
            <div className="flex flex-wrap gap-2">
              {headerOptions.map((header) => (
                <span key={header} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                  {header}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function SelectField({
  id,
  label,
  name,
  options,
  defaultValue,
}: {
  id: string
  label: string
  name: string
  options: readonly { value: string; label: string }[]
  defaultValue?: string
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required
        defaultValue={defaultValue ?? ''}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">Seleziona…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
