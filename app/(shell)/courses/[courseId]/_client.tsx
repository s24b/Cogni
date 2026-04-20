'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Cards,
  Lightning,
  CircleNotch,
  ClipboardText,
  GraduationCap,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem, ease } from '@/components/ui/motion'
import { QuizSession } from '@/components/quiz/QuizSession'

type Topic = {
  topic_id: string
  name: string
  syllabus_order: number | null
  content_coverage: number
  professor_weight: number
  card_count: number
  due_count: number
  mastery_score: number | null
}

type Course = {
  course_id: string
  name: string
  course_type: string | null
  professor_name: string | null
  topics: Topic[]
}

type TestResult = {
  result_id: string
  test_type: 'practice_quiz' | 'simulated_exam'
  score_pct: number | null
  question_count: number
  correct_count: number
  topic_filter: string | null
  created_at: string
}

function DualBar({ mastery, coverage }: { mastery: number | null; coverage: number }) {
  const m = Math.round((mastery ?? 0) * 100)
  const c = Math.round(coverage * 100)
  const mColor = m >= 75 ? 'bg-emerald-500' : m >= 40 ? 'bg-amber-400' : 'bg-red-400'
  const cColor = 'bg-blue-400'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-16 text-[10px] text-muted-foreground">Mastery</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${mColor}`} style={{ width: `${m}%` }} />
        </div>
        <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">{m}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 text-[10px] text-muted-foreground">Coverage</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${cColor}`} style={{ width: `${c}%` }} />
        </div>
        <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">{c}%</span>
      </div>
    </div>
  )
}

function TopicRow({ topic, courseId, onRefresh }: { topic: Topic; courseId: string; onRefresh: () => void }) {
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
      else onRefresh()
    } catch {
      setError('Failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium text-foreground">{topic.name}</span>
        {topic.card_count > 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Cards size={11} />
            {topic.card_count}
            {topic.due_count > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {topic.due_count} due
              </span>
            )}
          </span>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {generating ? <CircleNotch size={10} className="animate-spin" /> : <Lightning size={10} weight="fill" />}
            {generating ? 'Generating…' : 'Generate cards'}
          </button>
        )}
      </div>
      <DualBar mastery={topic.mastery_score} coverage={topic.content_coverage} />
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  )
}

function TestResultRow({ result }: { result: TestResult }) {
  const scorePct = Math.round(result.score_pct ?? 0)
  const scoreColor = scorePct >= 75 ? 'text-emerald-500' : scorePct >= 50 ? 'text-amber-500' : 'text-red-500'
  const date = new Date(result.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${result.test_type === 'simulated_exam' ? 'bg-purple-500/10' : 'bg-primary/10'}`}>
        {result.test_type === 'simulated_exam'
          ? <GraduationCap size={15} className="text-purple-500" weight="fill" />
          : <ClipboardText size={15} className="text-primary" weight="fill" />
        }
      </div>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-sm text-foreground">
          {result.test_type === 'simulated_exam' ? 'Simulated Exam' : 'Practice Quiz'}
          {result.topic_filter && <span className="ml-1 text-muted-foreground">· {result.topic_filter}</span>}
        </span>
        <span className="text-xs text-muted-foreground">{result.correct_count}/{result.question_count} correct · {date}</span>
      </div>
      <span className={`font-heading text-base font-bold tabular-nums ${scoreColor}`}>{scorePct}%</span>
    </div>
  )
}

type Mode = 'overview' | 'quiz' | 'exam'

export function CourseDetailClient({
  course,
  testResults,
}: {
  course: Course
  testResults: TestResult[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('overview')

  const topicNames = course.topics.map(t => t.name)

  if (mode === 'quiz') {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <QuizSession
          courseId={course.course_id}
          courseName={course.name}
          topicOptions={topicNames}
          onClose={() => { setMode('overview'); router.refresh() }}
        />
      </div>
    )
  }

  if (mode === 'exam') {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <QuizSession
          courseId={course.course_id}
          courseName={course.name}
          examMode
          onClose={() => { setMode('overview'); router.refresh() }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4 shrink-0">
        <button
          onClick={() => router.back()}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen size={18} className="text-primary" weight="fill" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{course.name}</span>
          {course.professor_name && (
            <span className="text-xs text-muted-foreground">{course.professor_name}</span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-6 p-5">

          {/* Practice buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('quiz')}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4 text-left hover:bg-muted/20 transition-colors"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardText size={18} className="text-primary" weight="fill" />
              </div>
              <span className="text-sm font-semibold text-foreground">Practice Quiz</span>
              <span className="text-xs text-muted-foreground leading-snug">Custom questions, weak-area weighted</span>
            </button>
            <button
              onClick={() => setMode('exam')}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4 text-left hover:bg-muted/20 transition-colors"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10">
                <GraduationCap size={18} className="text-purple-500" weight="fill" />
              </div>
              <span className="text-sm font-semibold text-foreground">Simulated Exam</span>
              <span className="text-xs text-muted-foreground leading-snug">Timed, mirrors your professor&apos;s style</span>
            </button>
          </div>

          {/* Topics */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Topics</h2>
              <span className="text-xs text-muted-foreground">{course.topics.length}</span>
            </div>
            {course.topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No topics yet — upload a syllabus in the Inbox.</p>
            ) : (
              <StaggerList className="flex flex-col gap-2">
                {course.topics.map(topic => (
                  <StaggerItem key={topic.topic_id}>
                    <TopicRow
                      topic={topic}
                      courseId={course.course_id}
                      onRefresh={() => router.refresh()}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>

          {/* Test history */}
          {testResults.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Test History</h2>
              <StaggerList className="flex flex-col gap-2">
                {testResults.map(r => (
                  <StaggerItem key={r.result_id}>
                    <TestResultRow result={r} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
