'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  FilePdf,
  FileText,
  File,
  UploadSimple,
  CircleNotch,
  Tray,
  X,
  PlusCircle,
  ArrowRight,
  Keyboard,
  Check,
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

type StagedItem = {
  id: string
  type: 'file' | 'text'
  file?: File
  context: string    // context hint for classification (for files) or label (for text)
  textContent: string  // the typed content (text entries only)
  name: string
  error?: string
  done?: boolean
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
  if (fileType === 'pdf') return <FilePdf size={18} className="text-red-400" weight="fill" />
  if (fileType === 'typed') return <Keyboard size={18} className="text-primary" weight="fill" />
  if (fileType === 'txt' || fileType === 'md') return <FileText size={18} className="text-muted-foreground" weight="fill" />
  return <File size={18} className="text-muted-foreground" weight="fill" />
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

function StagedItemRow({
  item,
  onRemove,
  onChange,
}: {
  item: StagedItem
  onRemove: () => void
  onChange: (patch: Partial<StagedItem>) => void
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 ${item.done ? 'border-emerald-500/40 opacity-60' : item.error ? 'border-red-400/40' : 'border-border'}`}>
      <div className="flex items-center gap-2">
        {item.done
          ? <Check size={16} className="text-emerald-500 shrink-0" weight="bold" />
          : item.type === 'text'
            ? <Keyboard size={16} className="text-primary shrink-0" weight="fill" />
            : <FileIcon fileType={item.file?.name.endsWith('.pdf') ? 'pdf' : 'txt'} />
        }
        <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
        {!item.done && (
          <button
            onClick={onRemove}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {!item.done && item.type === 'text' && (
        <textarea
          value={item.textContent}
          onChange={e => onChange({ textContent: e.target.value })}
          placeholder="Type your notes here…"
          rows={4}
          className="w-full resize-none rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}

      {!item.done && (
        <input
          type="text"
          value={item.context}
          onChange={e => onChange({ context: e.target.value })}
          placeholder={item.type === 'text' ? 'Label (e.g. "Week 3 notes on limits")' : 'Context hint (optional) — e.g. "Week 3 lecture, Physics 101"'}
          className="w-full rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}

      {item.error && (
        <span className="text-xs text-red-500">{item.error}</span>
      )}
    </div>
  )
}

export function InboxClient({ items }: { items: InboxItem[] }) {
  const router = useRouter()
  const [staged, setStaged] = useState<StagedItem[]>([])
  const [processing, setProcessing] = useState(false)
  const counterRef = useRef(0)

  function nextId() {
    counterRef.current += 1
    return `item-${counterRef.current}`
  }

  const onDrop = useCallback((accepted: File[]) => {
    setStaged(prev => [
      ...prev,
      ...accepted.map(file => ({
        id: nextId(),
        type: 'file' as const,
        file,
        name: file.name,
        context: '',
        textContent: '',
      })),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    multiple: true,
    disabled: processing,
  })

  function addTextEntry() {
    setStaged(prev => [...prev, {
      id: nextId(),
      type: 'text',
      name: 'Text note',
      context: '',
      textContent: '',
    }])
  }

  function updateItem(id: string, patch: Partial<StagedItem>) {
    setStaged(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeItem(id: string) {
    setStaged(prev => prev.filter(item => item.id !== id))
  }

  async function processAll() {
    setProcessing(true)
    let anySuccess = false

    for (const item of staged) {
      if (item.done) continue
      const form = new FormData()
      if (item.context) form.append('context', item.context)

      if (item.type === 'file' && item.file) {
        form.append('file', item.file)
      } else if (item.type === 'text') {
        if (!item.textContent.trim()) {
          updateItem(item.id, { error: 'Text content is empty.' })
          continue
        }
        form.append('textContent', item.textContent)
        form.append('name', item.context || 'Note')
      }

      try {
        const res = await fetch('/api/inbox/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (!res.ok) {
          updateItem(item.id, { error: json.error ?? 'Upload failed' })
        } else {
          updateItem(item.id, { done: true, error: undefined })
          anySuccess = true
        }
      } catch {
        updateItem(item.id, { error: 'Upload failed' })
      }
    }

    if (anySuccess) router.refresh()
    setProcessing(false)

    // Clear done items after a moment
    setTimeout(() => {
      setStaged(prev => prev.filter(item => !item.done))
    }, 1500)
  }

  const pendingCount = staged.filter(item => !item.done).length

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload files or type notes — Cogni will classify and assign them automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
            processing
              ? 'border-border bg-muted/30 cursor-not-allowed'
              : isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
            <UploadSimple size={20} className="text-primary" weight="bold" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isDragActive ? 'Drop to add' : 'Drop files or click to browse'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">PDF, TXT, or Markdown — multiple files supported</p>
          </div>
        </div>

        {/* Staged items */}
        {staged.length > 0 && (
          <div className="flex flex-col gap-2">
            {staged.map(item => (
              <StagedItemRow
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
                onChange={patch => updateItem(item.id, patch)}
              />
            ))}
          </div>
        )}

        {/* Add text note + Process row */}
        <div className="flex items-center gap-3">
          <button
            onClick={addTextEntry}
            disabled={processing}
            className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/10 px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-40"
          >
            <PlusCircle size={15} weight="fill" />
            Add text note
          </button>

          {pendingCount > 0 && (
            <button
              onClick={processAll}
              disabled={processing}
              className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {processing
                ? <><CircleNotch size={14} className="animate-spin" /> Processing…</>
                : <><ArrowRight size={14} weight="bold" /> Process {pendingCount} {pendingCount === 1 ? 'item' : 'items'}</>
              }
            </button>
          )}
        </div>

        {/* Item list */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <Tray size={36} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nothing here yet. Upload your first document above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Recent uploads</h2>
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
    </div>
  )
}
