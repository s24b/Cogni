'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  FilePdf,
  FileText,
  File,
  UploadSimple,
  CircleNotch,
  Tray,
} from '@phosphor-icons/react'

type InboxItem = {
  inbox_item_id: string
  classification_status: 'pending' | 'classified' | 'unassigned' | 'failed'
  course_id: string | null
  tier: number | null
  created_at: string
  materials: {
    filename: string
    file_type: string | null
  }
  courses: {
    name: string
  } | null
}

const TIER_LABEL: Record<number, string> = {
  1: 'Syllabus',
  2: 'Primary',
  3: 'Supplementary',
  4: 'Misc',
}

function StatusBadge({ status }: { status: InboxItem['classification_status'] }) {
  const map = {
    pending: { dot: 'bg-amber-400', text: 'Processing…', label: 'text-amber-600 dark:text-amber-400' },
    classified: { dot: 'bg-emerald-400', text: 'Classified', label: 'text-emerald-600 dark:text-emerald-400' },
    unassigned: { dot: 'bg-orange-400', text: 'Review needed', label: 'text-orange-600 dark:text-orange-400' },
    failed: { dot: 'bg-red-400', text: 'Failed', label: 'text-red-600 dark:text-red-400' },
  }
  const { dot, text, label } = map[status]
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${label}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

function FileIcon({ fileType }: { fileType: string | null }) {
  if (fileType === 'pdf') return <FilePdf size={20} className="text-muted-foreground" />
  if (fileType === 'txt' || fileType === 'md') return <FileText size={20} className="text-muted-foreground" />
  return <File size={20} className="text-muted-foreground" />
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function InboxClient({ items }: { items: InboxItem[] }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/inbox/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) setUploadError(json.error ?? 'Upload failed')
    } catch {
      setUploadError('Upload failed')
    } finally {
      setUploading(false)
      router.refresh()
    }
  }, [router])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => { if (accepted[0]) uploadFile(accepted[0]) },
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop syllabuses, lecture notes, and study guides — Cogni will classify them automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
          uploading
            ? 'border-border bg-muted/30 cursor-not-allowed'
            : isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <>
            <CircleNotch size={28} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Classifying…</p>
            <p className="text-xs text-muted-foreground">This usually takes a few seconds</p>
          </>
        ) : (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <UploadSimple size={22} className="text-primary" weight="bold" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {isDragActive ? 'Drop to upload' : 'Drop a file or click to browse'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">PDF, TXT, or Markdown</p>
            </div>
          </>
        )}
      </div>

      {uploadError && (
        <p className="text-sm text-red-500">{uploadError}</p>
      )}

      {/* Item list */}
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <Tray size={36} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nothing here yet. Upload your first document above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.inbox_item_id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <FileIcon fileType={item.materials.file_type} />

              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span className="truncate text-sm font-medium text-foreground">
                  {item.materials.filename}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={item.classification_status} />
                  {item.courses && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {item.courses.name}
                    </span>
                  )}
                  {item.tier && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {TIER_LABEL[item.tier] ?? `Tier ${item.tier}`}
                    </span>
                  )}
                </div>
              </div>

              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
