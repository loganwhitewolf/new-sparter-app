'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, FileUp, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MAX_IMPORT_FILE_SIZE_BYTES,
  IMPORT_CONTENT_TYPES,
} from '@/lib/validations/import'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']
const ACCEPTED_TYPES = IMPORT_CONTENT_TYPES as readonly string[]

type UploadStage = 'idle' | 'initiating' | 'uploading' | 'confirming' | 'done'

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
    const mb = Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))
    return `Il file supera la dimensione massima di ${mb} MB.`
  }
  return null
}

function stageLabel(stage: UploadStage): string {
  switch (stage) {
    case 'initiating': return 'Preparazione upload…'
    case 'uploading': return 'Caricamento file…'
    case 'confirming': return 'Verifica…'
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

    // Step 1: Initiate — get presigned URL + fileId
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
          type: selectedFile.type || 'text/csv',
        }),
      })
      if (!initiateRes.ok) {
        const body = await initiateRes.json().catch(() => ({}))
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

    // Step 2: PUT directly to R2 presigned URL — never proxy bytes through server
    setStage('uploading')
    try {
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          ...uploadHeaders,
          'Content-Length': String(selectedFile.size),
        },
        body: selectedFile,
      })
      if (!putRes.ok) {
        setError('Caricamento su storage fallito. Riprova.')
        setStage('idle')
        return
      }
    } catch {
      setError('Errore di rete durante il caricamento del file.')
      setStage('idle')
      return
    }

    // Step 3: Confirm — tell server the file is in R2
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

    // Step 4: Redirect to analyze page
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
