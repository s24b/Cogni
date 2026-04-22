'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  CaretRight,
  ArrowCounterClockwise,
  Archive,
  CaretDown,
  Warning,
  User,
  X,
  Plus,
  UploadSimple,
  CheckCircle,
  MagnifyingGlass,
  PencilSimple,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { StaggerList, StaggerItem } from '@/components/ui/motion'
import { COURSE_ICON_MAP, ICON_NAMES, ICON_COLORS, resolveIcon, resolveColor, DEFAULT_ICON, DEFAULT_COLOR, type IconColorId } from '@/lib/course-icons'

type CourseCard = {
  course_id: string
  name: string
  icon: string | null
  icon_color: string | null
  professor_id?: string | null
  professor_name: string | null
  topic_count: number
  card_count: number
  avg_coverage: number
  avg_mastery: number
  material_count: number
  has_primary_material: boolean
}

function CoverageBar({ coverage, mastery }: { coverage: number; mastery: number }) {
  const cPct = Math.round(coverage * 100)
  const mPct = Math.round(mastery * 100)
  const color = cPct >= 70 ? 'bg-emerald-500' : cPct >= 35 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="w-14 text-[10px] text-muted-foreground shrink-0">Coverage</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${cPct}%` }} />
        </div>
        <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{cPct}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 text-[10px] text-muted-foreground shrink-0">Mastery</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${mPct >= 75 ? 'bg-emerald-500' : mPct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${mPct}%` }}
          />
        </div>
        <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{mPct}%</span>
      </div>
    </div>
  )
}

function IconPickerModal({ courseId, currentIcon, currentColor, onClose, onSaved }: {
  courseId: string
  currentIcon: string
  currentColor: string
  onClose: () => void
  onSaved: (icon: string, color: string) => void
}) {
  const [selectedIcon, setSelectedIcon] = useState(currentIcon)
  const [selectedColor, setSelectedColor] = useState(currentColor)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()))

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icon: selectedIcon, icon_color: selectedColor }),
    }).catch(() => {})
    onSaved(selectedIcon, selectedColor)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <span className="text-sm font-semibold text-foreground">Customize icon</span>
          <button onClick={onClose} className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <MagnifyingGlass size={13} className="text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search icons…"
              className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Icon grid */}
        <div className="overflow-y-auto px-4 pb-3 flex-1">
          <div className="grid grid-cols-6 gap-1.5">
            {filtered.map(name => {
              const IconComp = COURSE_ICON_MAP[name]
              const colorStyle = resolveColor(selectedColor)
              const isSelected = name === selectedIcon
              return (
                <button
                  key={name}
                  onClick={() => setSelectedIcon(name)}
                  title={name}
                  className={`flex aspect-square items-center justify-center rounded-lg transition-all ${
                    isSelected
                      ? `${colorStyle.bg} ring-2 ring-primary`
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <IconComp size={18} className={isSelected ? colorStyle.icon : 'text-muted-foreground'} weight="fill" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Color swatches */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <span className="text-[11px] text-muted-foreground mb-2 block">Color</span>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(ICON_COLORS) as [IconColorId, typeof ICON_COLORS[IconColorId]][]).map(([id, style]) => (
              <button
                key={id}
                onClick={() => setSelectedColor(id)}
                className={`size-6 rounded-full ${style.swatch} transition-all ${
                  selectedColor === id ? 'ring-2 ring-offset-2 ring-primary ring-offset-card' : 'opacity-70 hover:opacity-100'
                }`}
                aria-label={id}
              />
            ))}
          </div>
        </div>

        {/* Preview + actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className={`flex size-8 items-center justify-center rounded-lg ${resolveColor(selectedColor).bg}`}>
              {(() => { const IC = resolveIcon(selectedIcon); return <IC size={16} className={resolveColor(selectedColor).icon} weight="fill" /> })()}
            </div>
            <span className="text-xs text-muted-foreground">{selectedIcon}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function CourseGridCard({ course }: { course: CourseCard }) {
  const router = useRouter()
  const [localIcon, setLocalIcon] = useState(course.icon ?? DEFAULT_ICON)
  const [localColor, setLocalColor] = useState(course.icon_color ?? DEFAULT_COLOR)
  const [showPicker, setShowPicker] = useState(false)

  const noContent = course.topic_count === 0
  const noMaterial = course.topic_count > 0 && !course.has_primary_material
  const colorStyle = resolveColor(localColor)
  const IconComp = resolveIcon(localIcon)

  return (
    <>
      <div
        onClick={() => router.push(`/courses/${course.course_id}`)}
        className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/20 active:scale-[0.99] transition-all cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <button
            onClick={e => { e.stopPropagation(); setShowPicker(true) }}
            className={`group relative flex size-9 shrink-0 items-center justify-center rounded-lg ${colorStyle.bg} hover:ring-2 hover:ring-primary/40 transition-all`}
            aria-label="Change icon"
          >
            <IconComp size={18} className={colorStyle.icon} weight="fill" />
            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <PencilSimple size={12} className="text-foreground" />
            </span>
          </button>
          <div className="flex flex-1 flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground leading-tight truncate">{course.name}</span>
            {course.professor_name && (
              <span className="mt-0.5 text-xs text-muted-foreground truncate">{course.professor_name}</span>
            )}
          </div>
          <CaretRight size={14} className="text-muted-foreground/60 shrink-0 mt-0.5" />
        </div>

        {noContent ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5">
            <Warning size={13} className="text-amber-500 shrink-0" weight="fill" />
            <span className="text-[11px] text-amber-600 dark:text-amber-400">No topics yet — upload a syllabus</span>
          </div>
        ) : noMaterial ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5">
            <Warning size={13} className="text-amber-500 shrink-0" weight="fill" />
            <span className="text-[11px] text-amber-600 dark:text-amber-400">Upload notes to build coverage</span>
          </div>
        ) : (
          <CoverageBar coverage={course.avg_coverage} mastery={course.avg_mastery} />
        )}

        <div className="flex items-center gap-3 border-t border-border/50 pt-2.5">
          <span className="text-[11px] text-muted-foreground">{course.topic_count} topics</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[11px] text-muted-foreground">{course.card_count} cards</span>
          {course.material_count > 0 && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground">{course.material_count} materials</span>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showPicker && (
          <IconPickerModal
            courseId={course.course_id}
            currentIcon={localIcon}
            currentColor={localColor}
            onClose={() => setShowPicker(false)}
            onSaved={(icon, color) => {
              setLocalIcon(icon)
              setLocalColor(color)
              setShowPicker(false)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function ProfessorWikiModal({ name, wiki, onClose }: { name: string | null; wiki: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <User size={15} className="text-primary" weight="fill" />
            <span className="text-sm font-semibold text-foreground">{name ?? 'Professor'} Profile</span>
          </div>
          <button onClick={onClose} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        </div>
        <div className="overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {wiki}
        </div>
      </motion.div>
    </div>
  )
}

function ArchivedCourseRow({ course, professorWiki, onReactivate }: { course: CourseCard; professorWiki: string | null; onReactivate: () => void }) {
  const [loading, setLoading] = useState(false)
  const [showWiki, setShowWiki] = useState(false)

  async function handleReactivate() {
    setLoading(true)
    try {
      await fetch(`/api/courses/${course.course_id}/archive`, { method: 'DELETE' })
      onReactivate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Archive size={15} className="text-muted-foreground" weight="fill" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{course.name}</span>
          {course.professor_name && (
            <span className="text-xs text-muted-foreground">{course.professor_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {professorWiki && (
            <button
              onClick={() => setShowWiki(true)}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <User size={11} weight="fill" />
              Profile
            </button>
          )}
          <button
            onClick={handleReactivate}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            <ArrowCounterClockwise size={12} weight="bold" />
            Reactivate
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showWiki && professorWiki && (
          <ProfessorWikiModal
            name={course.professor_name}
            wiki={professorWiki}
            onClose={() => setShowWiki(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function AddCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [professorName, setProfessorName] = useState('')
  const [existingProfessor, setExistingProfessor] = useState<{ professor_id: string; name: string } | null>(null)
  const [suggestions, setSuggestions] = useState<{ professor_id: string; name: string }[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
  })

  function handleProfessorChange(value: string) {
    setProfessorName(value)
    setExistingProfessor(null)
    setSuggestions([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        const res = await fetch(`/api/professors/search?name=${encodeURIComponent(value)}`)
        const { professors } = await res.json()
        setSuggestions(professors ?? [])
      }, 400)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!name.trim() || !professorName.trim()) {
      setError('Course name and professor name are required.')
      return
    }
    setLoading(true)
    const form = new FormData()
    form.append('name', name.trim())
    form.append('professorName', professorName.trim())
    if (existingProfessor) form.append('existingProfessorId', existingProfessor.professor_id)
    if (file) form.append('syllabus', file)

    try {
      const res = await fetch('/api/courses/create', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create course.')
        setLoading(false)
        return
      }
      if (data.warning) {
        toast.warning(data.warning)
      } else if (file) {
        toast.success('Course created — topics will appear shortly.')
      } else {
        toast.success('Course created.')
      }
      // If no syllabus uploaded, trigger web search in its own Vercel function invocation
      if (!data.hasSyllabus && data.courseId) {
        fetch(`/api/courses/${data.courseId}/web-enrichment`, { method: 'POST' }).catch(() => null)
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create course.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-primary" weight="fill" />
            <span className="text-sm font-semibold text-foreground">Add a new course</span>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-course-name" className="text-xs font-medium text-foreground">Course name</label>
            <input
              id="new-course-name"
              placeholder="e.g. Organic Chemistry"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              disabled={loading}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-course-prof" className="text-xs font-medium text-foreground">Professor name</label>
            <div className="relative">
              <input
                id="new-course-prof"
                placeholder="e.g. Dr. Smith"
                value={professorName}
                onChange={e => handleProfessorChange(e.target.value)}
                autoComplete="off"
                disabled={loading}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
              />
              {suggestions.length > 0 && !existingProfessor && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-md">
                  {suggestions.map(prof => (
                    <button
                      key={prof.professor_id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                      onClick={() => {
                        setProfessorName(prof.name)
                        setExistingProfessor(prof)
                        setSuggestions([])
                      }}
                    >
                      <CheckCircle size={13} weight="fill" className="text-primary" />
                      Use existing profile: {prof.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {existingProfessor && (
              <p className="flex items-center gap-1 text-xs text-primary">
                <CheckCircle size={11} weight="fill" />
                Using existing profile for {existingProfessor.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">
              Syllabus <span className="text-muted-foreground font-normal">(optional — can be added later)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <CheckCircle size={14} weight="fill" className="shrink-0 text-green-500" />
                <span className="truncate text-foreground">{file.name}</span>
                <button
                  onClick={() => setFile(null)}
                  disabled={loading}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  aria-label="Remove file"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border border-dashed px-4 py-4 text-center text-xs transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <input {...getInputProps()} disabled={loading} />
                <UploadSimple size={14} className="mx-auto mb-1" />
                {isDragActive ? 'Drop it here' : 'Drop PDF or TXT, or click to browse'}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {loading && file && (
            <p className="text-xs text-muted-foreground">Extracting topics from syllabus — this can take up to 15 seconds…</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !professorName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Creating…' : (<><Plus size={12} weight="bold" />Create course</>)}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

type ArchivedCourseCard = CourseCard & { professor_wiki: string | null }

export function CoursesClient({
  courses,
  archivedCourses,
}: {
  courses: CourseCard[]
  archivedCourses: ArchivedCourseCard[]
}) {
  const router = useRouter()
  const [showArchived, setShowArchived] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  if (courses.length === 0 && archivedCourses.length === 0) {
    return (
      <>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center p-6">
          <BookOpen size={36} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No courses yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={13} weight="bold" />
            Add your first course
          </button>
        </div>
        <AnimatePresence>
          {showAddModal && (
            <AddCourseModal
              onClose={() => setShowAddModal(false)}
              onCreated={() => {
                setShowAddModal(false)
                router.refresh()
              }}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 p-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Courses</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tap a course to practice, view materials, and track progress.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={12} weight="bold" />
            Add course
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center rounded-xl border border-dashed border-border">
            <BookOpen size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">All courses archived.</p>
          </div>
        ) : (
          <StaggerList className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {courses.map(course => (
              <StaggerItem key={course.course_id}>
                <CourseGridCard course={course} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {archivedCourses.length > 0 && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showArchived ? <CaretDown size={14} /> : <CaretRight size={14} />}
              <Archive size={14} />
              {archivedCourses.length} archived {archivedCourses.length === 1 ? 'course' : 'courses'}
            </button>
            {showArchived && (
              <StaggerList className="flex flex-col gap-2">
                {archivedCourses.map(course => (
                  <StaggerItem key={course.course_id}>
                    <ArchivedCourseRow
                      course={course}
                      professorWiki={course.professor_wiki}
                      onReactivate={() => router.refresh()}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddCourseModal
            onClose={() => setShowAddModal(false)}
            onCreated={() => {
              setShowAddModal(false)
              router.refresh()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
