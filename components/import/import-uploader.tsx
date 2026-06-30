'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, FileUp, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UploadPutError, uploadFileToPresignedUrl } from '@/components/import/upload-put'
import { analyzeImportAction } from '@/lib/actions/import'
import { isUnknownFormatAnalysis } from '@/lib/utils/import-status'
import {
  MAX_IMPORT_FILE_SIZE_BYTES,
  IMPORT_CONTENT_TYPES,
} from '@/lib/validations/import'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.pdf']
const ACCEPTED_TYPES = IMPORT_CONTENT_TYPES as readonly string[]

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
    return 'Tipo di file non supportato. Usa un file CSV, XLSX o PDF.'
  }
  if (file.size === 0) {
    return 'Il file è vuoto.'
  }
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    const mb = Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))
    return `Il file supera la dimensione massima di ${mb} MB.`
  }
  return null
}

function stageLabel(stage: UploadStage): string {
  switch (stage) {
    case 'hashing': return 'Controllo duplicati…'
    case 'initiating': return 'Preparazione upload…'
    case 'uploading': return 'Caricamento file…'
    case 'confirming': return 'Verifica…'
    case 'analyzing': return 'Analisi formato…'
    case 'done': return 'Reindirizzamento…'
    default: return 'Carica file'
  }
}

export function ImportUploader() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const isPending = stage !== 'idle'

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setError(null)
    setSelectedFile(file)
    if (file) {
      const err = validateFile(file)
      if (err) {
        setError(err)
        setSelectedFile(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError('Seleziona un file da importare.')
      return
    }
    const fileValidationError = validateFile(selectedFile)
    if (fileValidationError) {
      setError(fileValidationError)
      return
    }

    setError(null)

    // Step 1: Hash the file locally to detect duplicates before upload
    setStage('hashing')
    let contentHash: string
    try {
      contentHash = await sha256Hex(selectedFile)
    } catch {
      setError('Impossibile verificare il file. Riprova.')
      setStage('idle')
      return
    }

    // Step 2: Initiate — get presigned URL + fileId (server checks for duplicate hash)
    setStage('initiating')
    let fileId: string
    let presignedUrl: string
    let uploadHeaders: Record<string, string>
    try {
      const initiateRes = await fetch('/api/files/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          // When the browser reports an empty type, derive a fallback from the extension
          // so the server-side schema can still accept/reject the correct MIME bucket.
          type: selectedFile.type || (selectedFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/csv'),
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

    // Step 3: PUT directly to R2 presigned URL — never proxy bytes through server
    setStage('uploading')
    try {
      await uploadFileToPresignedUrl({
        fileId,
        url: presignedUrl,
        file: selectedFile,
        headers: uploadHeaders,
      })
    } catch (uploadError) {
      setError(uploadError instanceof UploadPutError ? uploadError.message : 'Errore di rete durante il caricamento del file.')
      setStage('idle')
      return
    }

    // Step 4: Confirm — tell server the file is in R2
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

    // Step 5: Analyze and route to configure (unknown format) or preview (recognized format)
    setStage('analyzing')
    const fd = new FormData()
    fd.set('fileId', fileId)

    const analyzeResult = await analyzeImportAction(fd)

    if (!analyzeResult.data) {
      setError(analyzeResult.error ?? 'Impossibile analizzare il file. Riprova tra qualche secondo.')
      setStage('idle')
      return
    }

    if (isUnknownFormatAnalysis(analyzeResult.data)) {
      setStage('done')
      router.push(`/import/${fileId}/configure`)
      return
    }

    setStage('done')
    router.push(`/import/${fileId}/analyze`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="import-file-input">
          File bancario
        </label>
        <Input
          id="import-file-input"
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          disabled={isPending}
          onChange={handleFileChange}
          aria-describedby={error ? 'import-file-error' : undefined}
          aria-invalid={error ? 'true' : undefined}
        />
        {selectedFile && !error && (
          <p className="text-xs text-muted-foreground">
            {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" id="import-file-error" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleUpload}
        disabled={isPending || !selectedFile || !!error}
        aria-busy={isPending}
        aria-label={isPending ? stageLabel(stage) : 'Carica file'}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileUp className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {stageLabel(stage)}
      </Button>
    </div>
  )
}
