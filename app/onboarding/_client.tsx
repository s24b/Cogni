'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  User,
  Key,
  Clock,
  BookOpen,
  Upload,
  Calendar,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseEntry = {
  id: string
  name: string
  professorName: string
  existingProfessor: { professor_id: string; name: string } | null
}

type SyllabusEntry = {
  courseId: string
  file: File | null
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6

const TOTAL_STEPS = 6

const SLIDE_TRANSITION = { duration: 0.22 } as const

// ─── Syllabus upload card ─────────────────────────────────────────────────────

function SyllabusCard({
  courseName,
  file,
  onFile,
}: {
  courseName: string
  file: File | null
  onFile: (f: File | null) => void
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0])
    },
    [onFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
  })

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{courseName}</p>
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <span className="truncate text-foreground">{file.name}</span>
          <button
            onClick={() => onFile(null)}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border border-dashed px-4 py-4 text-center text-sm transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-1 h-4 w-4" />
          {isDragActive ? 'Drop it here' : 'Drop PDF or TXT, or click to browse'}
        </div>
      )}
    </div>
  )
}

// ─── Step icon ────────────────────────────────────────────────────────────────

const STEP_ICONS = [User, Key, Clock, BookOpen, Upload, Calendar]

function StepIcon({ step }: { step: number }) {
  const Icon = STEP_ICONS[step]
  return (
    <motion.div
      key={step}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
      className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
    >
      <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingClient({ googleName }: { googleName: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(0)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 0 — Name
  const [name, setName] = useState(googleName)

  // Step 1 — API Key
  const [apiKey, setApiKey] = useState('')

  // Step 2 — Session Length
  const [sessionLength, setSessionLength] = useState<25 | 45 | 90>(45)

  // Step 3 — Courses
  const [courses, setCourses] = useState<CourseEntry[]>([
    { id: crypto.randomUUID(), name: '', professorName: '', existingProfessor: null },
  ])
  const [professorSuggestions, setProfessorSuggestions] = useState<
    Record<string, { professor_id: string; name: string }[]>
  >({})
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Step 4 — Syllabuses
  const [syllabuses, setSyllabuses] = useState<SyllabusEntry[]>([])

  // Sync syllabuses when courses change
  useEffect(() => {
    setSyllabuses(prev => {
      const next: SyllabusEntry[] = courses.map(c => {
        const existing = prev.find(s => s.courseId === c.id)
        return existing ?? { courseId: c.id, file: null }
      })
      return next
    })
  }, [courses])

  // ── Navigation helpers ───────────────────────────────────────────────────

  function advance() {
    setDirection(1)
    setStep(s => (s + 1) as Step)
  }

  function back() {
    setDirection(-1)
    setStep(s => (s - 1) as Step)
  }

  // ── Step-specific continue handlers ─────────────────────────────────────

  async function handleContinueName() {
    if (!name.trim()) {
      toast.error('Please enter your name.')
      return
    }
    advance()
  }

  async function handleContinueApiKey() {
    const trimmed = apiKey.trim()
    if (!trimmed.startsWith('sk-') || trimmed.length < 20) {
      toast.error('Enter a valid API key (starts with "sk-").')
      return
    }
    setLoading(true)
    const res = await fetch('/api/settings/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: trimmed }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to save key.')
      return
    }
    advance()
  }

  async function handleContinueCourses() {
    const valid = courses.filter(c => c.name.trim() && c.professorName.trim())
    if (valid.length === 0) {
      toast.error('Add at least one course with a professor name.')
      return
    }
    setCourses(valid)
    advance()
  }

  // ── Professor name debounce search ───────────────────────────────────────

  function handleProfessorNameChange(courseId: string, value: string) {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId ? { ...c, professorName: value, existingProfessor: null } : c,
      ),
    )
    setProfessorSuggestions(prev => ({ ...prev, [courseId]: [] }))

    clearTimeout(debounceRefs.current[courseId])
    if (value.trim().length >= 2) {
      debounceRefs.current[courseId] = setTimeout(async () => {
        const res = await fetch(`/api/professors/search?name=${encodeURIComponent(value)}`)
        const { professors } = await res.json()
        setProfessorSuggestions(prev => ({ ...prev, [courseId]: professors }))
      }, 400)
    }
  }

  function chooseProfessor(
    courseId: string,
    prof: { professor_id: string; name: string },
  ) {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? { ...c, professorName: prof.name, existingProfessor: prof }
          : c,
      ),
    )
    setProfessorSuggestions(prev => ({ ...prev, [courseId]: [] }))
  }

  // ── Final completion ─────────────────────────────────────────────────────

  async function runCompletion() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Session expired. Please sign in again.')
      router.push('/auth')
      return
    }

    // Upload syllabus files to Supabase Storage
    const syllabusUploads: { courseTemp: number; storagePath: string; fileName: string }[] = []

    for (let i = 0; i < courses.length; i++) {
      const syl = syllabuses.find(s => s.courseId === courses[i].id)
      if (!syl?.file) continue

      const path = `${user.id}/syllabuses/${Date.now()}_${syl.file.name}`
      const { data, error } = await supabase.storage
        .from('materials')
        .upload(path, syl.file)

      if (error) {
        console.warn('Syllabus upload failed:', error.message)
        continue
      }
      syllabusUploads.push({ courseTemp: i, storagePath: data.path, fileName: syl.file.name })
    }

    // Write all records via onboarding complete route
    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: name,
        sessionLength,
        courses: courses.map((c, i) => ({
          tempIndex: i,
          name: c.name,
          professorName: c.professorName,
          existingProfessorId: c.existingProfessor?.professor_id ?? null,
        })),
        syllabuses: syllabusUploads,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error ?? 'Something went wrong. Please try again.')
      setStep(0)
      return
    }

    // Brief pause so the loading screen shows
    await new Promise(r => setTimeout(r, 1200))
    router.push('/today')
  }

  useEffect(() => {
    if (step === 6) {
      runCompletion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-background px-4 py-10">
      {/* Logo */}
      <div className="flex w-full max-w-lg items-center">
        <Image src="/logo.svg" alt="Cogni" width={28} height={28} priority />
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg flex-1 py-8">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 6 ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-6 py-20 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="h-10 w-10 rounded-full border-2 border-border border-t-primary"
              />
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">
                  Cogni is getting to know your courses.
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This only takes a moment.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
              transition={SLIDE_TRANSITION}
              className="flex flex-col"
            >
              <StepIcon step={step} />

              {step === 0 && (
                <StepName name={name} setName={setName} />
              )}
              {step === 1 && (
                <StepApiKey apiKey={apiKey} setApiKey={setApiKey} />
              )}
              {step === 2 && (
                <StepSessionLength
                  value={sessionLength}
                  onChange={setSessionLength}
                />
              )}
              {step === 3 && (
                <StepCourses
                  courses={courses}
                  setCourses={setCourses}
                  professorSuggestions={professorSuggestions}
                  onProfessorNameChange={handleProfessorNameChange}
                  onChooseProfessor={chooseProfessor}
                />
              )}
              {step === 4 && (
                <StepSyllabuses
                  courses={courses}
                  syllabuses={syllabuses}
                  setSyllabuses={setSyllabuses}
                />
              )}
              {step === 5 && <StepCalendar />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation + progress dots */}
      {step < 6 && (
        <div className="flex w-full max-w-lg flex-col gap-6">
          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-5 bg-primary'
                    : i < step
                    ? 'w-1.5 bg-primary/40'
                    : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={back}
                disabled={loading}
                className="shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}

            <Button
              className="flex-1"
              size="lg"
              onClick={handleContinueForStep(step, {
                handleContinueName,
                handleContinueApiKey,
                advance,
                handleContinueCourses,
              })}
              disabled={loading}
            >
              {loading ? (
                'Saving…'
              ) : step === TOTAL_STEPS - 1 ? (
                <>
                  Get started
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Skip — steps 4 and 5 */}
          {(step === 4 || step === 5) && (
            <button
              onClick={advance}
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Skip for now
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helper: which handler runs on Continue ──────────────────────────────────

function handleContinueForStep(
  step: number,
  fns: {
    handleContinueName: () => void
    handleContinueApiKey: () => void
    advance: () => void
    handleContinueCourses: () => void
  },
) {
  const map: Record<number, () => void> = {
    0: fns.handleContinueName,
    1: fns.handleContinueApiKey,
    2: fns.advance,
    3: fns.handleContinueCourses,
    4: fns.advance,
    5: fns.advance,
  }
  return map[step] ?? fns.advance
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepName({
  name,
  setName,
}: {
  name: string
  setName: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          What should we call you?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is how Cogni will address you.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="display-name">Your name</Label>
        <Input
          id="display-name"
          placeholder="e.g. Alex"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>
    </div>
  )
}

function StepApiKey({
  apiKey,
  setApiKey,
}: {
  apiKey: string
  setApiKey: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          You&apos;ll need an API key.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cogni uses AI to think. Your key is encrypted and never shared.
          Anthropic or OpenAI keys both work.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="api-key">API key</Label>
        <Input
          id="api-key"
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          autoFocus
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Get an Anthropic key at console.anthropic.com
        </p>
      </div>
    </div>
  )
}

function StepSessionLength({
  value,
  onChange,
}: {
  value: 25 | 45 | 90
  onChange: (v: 25 | 45 | 90) => void
}) {
  const options: { label: string; sub: string; value: 25 | 45 | 90 }[] = [
    { label: 'Short', sub: '25 minutes', value: 25 },
    { label: 'Medium', sub: '45 minutes', value: 45 },
    { label: 'Long', sub: '90 minutes', value: 90 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          How long do you like to study?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cogni will cap each session block at this length.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center rounded-xl border-2 px-3 py-5 text-center transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <span className="font-heading text-base font-bold text-foreground">
              {opt.label}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">{opt.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepCourses({
  courses,
  setCourses,
  professorSuggestions,
  onProfessorNameChange,
  onChooseProfessor,
}: {
  courses: CourseEntry[]
  setCourses: React.Dispatch<React.SetStateAction<CourseEntry[]>>
  professorSuggestions: Record<string, { professor_id: string; name: string }[]>
  onProfessorNameChange: (courseId: string, value: string) => void
  onChooseProfessor: (courseId: string, prof: { professor_id: string; name: string }) => void
}) {
  function addCourse() {
    setCourses(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', professorName: '', existingProfessor: null },
    ])
  }

  function removeCourse(id: string) {
    setCourses(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          What courses are you taking?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your courses and professors for this semester.
        </p>
      </div>

      <div className="space-y-4">
        {courses.map((course, idx) => (
          <div
            key={course.id}
            className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Course {idx + 1}
              </span>
              {courses.length > 1 && (
                <button
                  onClick={() => removeCourse(course.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove course"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`course-name-${course.id}`}>Course name</Label>
              <Input
                id={`course-name-${course.id}`}
                placeholder="e.g. Organic Chemistry"
                value={course.name}
                onChange={e =>
                  setCourses(prev =>
                    prev.map(c => (c.id === course.id ? { ...c, name: e.target.value } : c)),
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`prof-name-${course.id}`}>Professor name</Label>
              <div className="relative">
                <Input
                  id={`prof-name-${course.id}`}
                  placeholder="e.g. Dr. Smith"
                  value={course.professorName}
                  onChange={e => onProfessorNameChange(course.id, e.target.value)}
                  autoComplete="off"
                />
                {(professorSuggestions[course.id] ?? []).length > 0 &&
                  !course.existingProfessor && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-md">
                      {professorSuggestions[course.id].map(prof => (
                        <button
                          key={prof.professor_id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                          onClick={() => onChooseProfessor(course.id, prof)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          Use existing profile: {prof.name}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
              {course.existingProfessor && (
                <p className="flex items-center gap-1 text-xs text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  Using existing profile for {course.existingProfessor.name}
                </p>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={addCourse}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add another course
        </button>
      </div>
    </div>
  )
}

function StepSyllabuses({
  courses,
  syllabuses,
  setSyllabuses,
}: {
  courses: CourseEntry[]
  syllabuses: SyllabusEntry[]
  setSyllabuses: React.Dispatch<React.SetStateAction<SyllabusEntry[]>>
}) {
  function setFile(courseId: string, file: File | null) {
    setSyllabuses(prev =>
      prev.map(s => (s.courseId === courseId ? { ...s, file } : s)),
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Drop your syllabuses here.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cogni reads them to build your study plan. You can skip any course and add them later.
        </p>
      </div>

      <div className="space-y-4">
        {courses.map(course => {
          const syl = syllabuses.find(s => s.courseId === course.id)
          return (
            <SyllabusCard
              key={course.id}
              courseName={course.name || 'Unnamed course'}
              file={syl?.file ?? null}
              onFile={f => setFile(course.id, f)}
            />
          )
        })}
      </div>
    </div>
  )
}

function StepCalendar() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Connect your calendar.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cogni schedules study blocks around your existing events. You can connect later in Settings.
        </p>
      </div>

      <div className="space-y-3">
        {[
          { name: 'Google Calendar', sub: 'Most popular' },
          { name: 'Apple Calendar', sub: 'iCloud / CalDAV' },
          { name: 'Outlook', sub: 'Microsoft 365' },
        ].map(cal => (
          <div
            key={cal.name}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{cal.name}</p>
              <p className="text-xs text-muted-foreground">{cal.sub}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="text-xs"
              title="Calendar integration available after onboarding in Settings"
            >
              Connect
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Calendar integration is set up in Settings — come back after you&apos;re in.
      </p>
    </div>
  )
}
