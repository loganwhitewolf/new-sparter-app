'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ImportUploader } from '@/components/import/import-uploader'
import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/lib/validations/import'

const MAX_MB = Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))

export function ImportUploadDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Importa file
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importa file bancario</DialogTitle>
          <DialogDescription>
            Formati supportati: <strong>.csv</strong>, <strong>.xlsx</strong> — dimensione massima{' '}
            <strong>{MAX_MB} MB</strong>
          </DialogDescription>
        </DialogHeader>
        <ImportUploader />
      </DialogContent>
    </Dialog>
  )
}
