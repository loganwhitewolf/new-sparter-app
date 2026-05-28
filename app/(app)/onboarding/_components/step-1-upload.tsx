'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CloudUpload, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UploadPutError, uploadFileToPresignedUrl } from '@/components/import/upload-put'
import {
  MAX_IMPORT_FILE_SIZE_BYTES,
  IMPORT_CONTENT_TYPES,
} from '@/lib/validations/import'
import {
  analyzeImportAction,
  confirmImportAction,
} from '@/lib/actions/import'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']
const ACCEPTED_TYPES = IMPORT_CONTENT_TYPES as readonly string[]

// Onboarding respects the same 10 MB limit as the standard importer
const MAX_FILE_MB = Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))

type UploadStage = 'idle' | 'hashing' | 'initiating' | 'uploading' | 'confirming' | 'analyzing' | 'done'

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function validateFile(file: File): string | null {
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Formato non supportato. Usa ${ACCEPTED_EXTENSIONS.join(' o ')}.`
  }
  if (!ACCEPTED_TYPES.includes(file.type) && file.type !== '') {
    return 'Tipo di file non supportato. Usa un file CSV o XLSX.'
  }
  if (file.size === 0) {
    return 'Il file è vuoto.'
  }
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return `Il file supera la dimensione massima di ${MAX_FILE_MB} MB.`
  }
  return null
}

function stageLabel(stage: UploadStage): string {
  switch (stage) {
    case 'hashing': return 'Controllo duplicati…'
    case 'initiating': return 'Preparazione upload…'
    case 'uploading': return 'Caricamento file…'
    case 'confirming': return 'Verifica…'
    case 'analyzing': return 'Analisi in corso…'
    case 'done': return 'Reindirizzamento…'
    default: return 'Carica file'
  }
}

/**
 * Step 1 of the onboarding upload flow.
 * Reuses the R2 presigned PUT pipeline (D-04) and the existing analyzeImportAction +
 * confirmImportAction server actions so the import runs inside db.transaction per project rules.
 *
 * On success → redirects to /onboarding?step=2.
 * On unknown format → redirects to /import/[fileId]/configure?from=onboarding.
 */
export function Step1Upload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const isPending = stage !== 'idle'

  function pickFile(file: File) {
    setError(null)
    const err = validateFile(file)
    if (err) {
      setError(err)
      return
    }
    setSelectedFile(file)
    void processUpload(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file) pickFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0] ?? null
    if (file) pickFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  async function processUpload(file: File) {
    setError(null)

    // Step 1: Hash locally to detect duplicates before upload
    setStage('hashing')
    let contentHash: string
    try {
      contentHash = await sha256Hex(file)
    } catch {
      setError('Impossibile verificare il file. Riprova.')
      setStage('idle')
      return
    }

    // Step 2: Initiate — get presigned URL + fileId
    setStage('initiating')
    let fileId: string
    let presignedUrl: string
    let uploadHeaders: Record<string, string>
    try {
      const initiateRes = await fetch('/api/files/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type || 'text/csv',
          contentHash,
        }),
      })
      if (!initiateRes.ok) {
        const body = await initiateRes.json().catch(() => ({}))
        if (initiateRes.status === 409) {
          setError('Hai già importato questo file. Controlla la lista delle importazioni.')
          setStage('idle')
          return
        }
        const msg = body?.error?.message ?? 'Impossibile avviare il caricamento. Riprova.'
        setError(msg)
        setStage('idle')
        return
      }
      const initiateData = await initiateRes.json()
      fileId = initiateData.file.id
      presignedUrl = initiateData.upload.url
      uploadHeaders = initiateData.upload.headers ?? {}
    } catch {
      setError('Errore di rete durante la preparazione del caricamento.')
      setStage('idle')
      return
    }

    // Step 3: PUT directly to R2 via presigned URL — never proxy bytes through server
    setStage('uploading')
    try {
      await uploadFileToPresignedUrl({
        fileId,
        url: presignedUrl,
        file,
        headers: uploadHeaders,
      })
    } catch (uploadError) {
      setError(
        uploadError instanceof UploadPutError
          ? uploadError.message
          : 'Errore di rete durante il caricamento del file.',
      )
      setStage('idle')
      return
    }

    // Step 4: Confirm — tell server the file landed in R2
    setStage('confirming')
    try {
      const confirmRes = await fetch('/api/files/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}))
        const msg = body?.error?.message ?? 'Verifica caricamento fallita. Riprova.'
        setError(msg)
        setStage('idle')
        return
      }
    } catch {
      setError('Errore di rete durante la verifica del caricamento.')
      setStage('idle')
      return
    }

    // Step 5: Analyze — run the format detector via server action (inside db.transaction)
    setStage('analyzing')
    const fd = new FormData()
    fd.set('fileId', fileId)

    const analyzeResult = await analyzeImportAction(fd)

    if (analyzeResult.error || !analyzeResult.data) {
      // Unknown format — hand off to the format wizard; user returns to onboarding after configuring
      if (analyzeResult.data?.formatVersionId === null) {
        setStage('done')
        router.push(`/import/${fileId}/configure?from=onboarding`)
        return
      }
      setError(analyzeResult.error ?? 'Impossibile analizzare il file. Riprova tra qualche secondo.')
      setStage('idle')
      return
    }

    // Unknown format detected during analysis (no error returned but formatVersionId is null)
    if (analyzeResult.data.formatVersionId === null) {
      setStage('done')
      router.push(`/import/${fileId}/configure?from=onboarding`)
      return
    }

    // Step 6: Confirm import — runs importFile() inside db.transaction
    const confirmFd = new FormData()
    confirmFd.set('fileId', fileId)
    const importResult = await confirmImportAction(confirmFd)

    if (importResult.error) {
      setError(importResult.error)
      setStage('idle')
      return
    }

    // All done — advance to the overview step
    setStage('done')
    router.push('/onboarding?step=2')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center">
      <CloudUpload className="h-16 w-16 text-foreground/30 mb-6" aria-hidden="true" />
      <h1 className="text-4xl font-bold mb-3">Il tuo primo estratto conto</h1>
      <p className="text-muted-foreground text-base max-w-sm mb-12">
        Carica il file della tua banca e vedremo insieme dove vanno i tuoi soldi.
      </p>

      {/* Drop zone — token-based border only (D-09) */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isPending && inputRef.current?.click()}
        className={`w-full max-w-sm border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors flex flex-col items-center gap-3 mb-4 ${
          isDragOver
            ? 'border-foreground/40 bg-foreground/5'
            : 'border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5'
        } ${isPending ? 'pointer-events-none opacity-60' : ''}`}
        aria-label="Area di caricamento file"
        role="button"
        tabIndex={isPending ? -1 : 0}
        onKeyDown={(e) => {
          if (!isPending && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click()
        }}
      >
        {isPending ? (
          <div className="flex items-center gap-2 text-foreground/70">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="text-sm">{stageLabel(stage)}</span>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground/80">Trascina qui il tuo file</p>
            <p className="text-xs text-foreground/40">oppure clicca per sfogliare</p>
          </>
        )}
      </div>

      <p className="text-xs text-foreground/30">CSV, XLS, XLSX · max 10 MB</p>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        disabled={isPending}
        onChange={handleFileChange}
        aria-label="Seleziona file da importare"
      />

      {/* Error display */}
      {error && (
        <div className="mt-6 w-full max-w-sm">
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Selected file name (before upload starts) */}
      {selectedFile && !error && stage === 'idle' && (
        <p className="mt-4 text-xs text-foreground/50">
          {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
        </p>
      )}
    </div>
  )
}
