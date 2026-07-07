/** Client-safe row types for `/import/[fileId]` — no server-only DAL imports. */

export type FileStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'analyzing'
  | 'analyzed'
  | 'importing'
  | 'imported'
  | 'failed'

export type FileDetailContextRow = {
  id: string
  userId: string
  importFormatVersionId: number | null
  originalName: string
  displayName: string | null
  contentHash: string | null
  objectKey: string
  mimeType: string | null
  sizeBytes: number
  status: FileStatus
  uploadedAt: Date | null
  analyzedAt: Date | null
  importStartedAt: Date | null
  importedAt: Date | null
  rowCount: number
  importedCount: number
  duplicateCount: number
  positiveTotal: string
  negativeTotal: string
  referenceStartedAt: Date | null
  referenceEndedAt: Date | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  platformName: string | null
}

export type FileTransactionRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
  categoryType: 'in' | 'out' | 'allocation' | 'system' | 'transfer' | null
}
