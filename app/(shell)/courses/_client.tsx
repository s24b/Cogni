'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CaretDown,
  CaretRight,
  Lightning,
  CircleNotch,
  Cards,
  BookOpen,
  ClipboardText,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem, ease } from '@/components/ui/motion'

type Topic = {
  topic_id: string
  name: string
  syllabus_order: number | null
  card_count: number
  due_count: number
  mastery_score: number | null
}

type Course = {
  course_id: string
  name: string
  professor_name: string | null
  topics: Topic[]
}

function MasteryBar({ score }: { score: number | null }) {
  const pct = Math.round((score ?? 0) * 100)
  const color =
    pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  )
}

function TopicRow({ topic, courseId }: { topic: Topic; courseId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, topicId: topic.topic_id }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Failed')
      else startTransition(() => router.refresh())
    } catch {
      setError('Failed')
    } finally {
      setGenerating(false)
    }
  }

  const busy = generating || isPending

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <span className="text-sm text-foreground truncate">{topic.name}</span>
        <MasteryBar score={topic.mastery_score} />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {topic.card_count > 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Cards size={12} />
            {topic.card_count} cards
            {topic.due_count > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {topic.due_count} due
              </span>
            )}
          </span>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <CircleNotch size={12} className="animate-spin" />
            ) : (
              <Lightning size={12} weight="fill" />
            )}
            {busy ? 'Generating…' : 'Generate cards'}
          </button>
        )}
      </div>
    </div>
  )
}

function CourseCard({ course }: { course: Course }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen size={18} className="text-primary" weight="fill" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{course.name}</span>
          {course.professor_name && (
            <span className="text-xs text-muted-foreground">{course.professor_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{course.topics.length} topics</span>
          <button
            onClick={e => { e.stopPropagation(); router.push(`/courses/${course.course_id}`) }}
            className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <ClipboardText size={11} weight="fill" />
            Practice
          </button>
          {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && course.topics.length > 0 && (
          <motion.div
            key="topics"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.25, ease } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease } }}
            className="overflow-hidden border-t border-border"
          >
            <StaggerList className="px-2 py-1">
              {course.topics.map(topic => (
                <StaggerItem key={topic.topic_id}>
                  <TopicRow topic={topic} courseId={course.course_id} />
                </StaggerItem>
              ))}
            </StaggerList>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && course.topics.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.25, ease } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease } }}
            className="overflow-hidden border-t border-border px-5 py-4 text-sm text-muted-foreground"
          >
            No topics yet — upload a syllabus in the Inbox to get started.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CoursesClient({ courses }: { courses: Course[] }) {
  if (courses.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center p-6">
        <BookOpen size={36} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No courses yet. Complete onboarding to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your topics and flashcard progress by course.
        </p>
      </div>

      <StaggerList className="flex flex-col gap-3">
        {courses.map(course => (
          <StaggerItem key={course.course_id}>
            <CourseCard course={course} />
          </StaggerItem>
        ))}
      </StaggerList>
    </div>
  )
}
