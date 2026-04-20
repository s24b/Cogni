'use client'

import {
  ClipboardText,
  GraduationCap,
  TrendUp,
  ChartBar,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem } from '@/components/ui/motion'

type TestResult = {
  result_id: string
  test_type: 'practice_quiz' | 'simulated_exam'
  score_pct: number | null
  question_count: number
  correct_count: number
  topic_filter: string | null
  created_at: string
  courses: { name: string } | null
}

function TestResultRow({ result }: { result: TestResult }) {
  const scorePct = Math.round(result.score_pct ?? 0)
  const scoreColor = scorePct >= 75 ? 'text-emerald-500' : scorePct >= 50 ? 'text-amber-500' : 'text-red-500'
  const date = new Date(result.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const isExam = result.test_type === 'simulated_exam'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isExam ? 'bg-purple-500/10' : 'bg-primary/10'}`}>
        {isExam
          ? <GraduationCap size={15} className="text-purple-500" weight="fill" />
          : <ClipboardText size={15} className="text-primary" weight="fill" />
        }
      </div>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-foreground">
            {isExam ? 'Simulated Exam' : 'Practice Quiz'}
          </span>
          {result.topic_filter && (
            <span className="text-xs text-muted-foreground">· {result.topic_filter}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {result.courses?.name ?? 'Unknown course'} · {result.correct_count}/{result.question_count} correct · {date}
        </span>
      </div>
      <span className={`font-heading text-base font-bold tabular-nums shrink-0 ${scoreColor}`}>{scorePct}%</span>
    </div>
  )
}

function AverageScore({ results }: { results: TestResult[] }) {
  if (results.length === 0) return null
  const avg = results.reduce((sum, r) => sum + (r.score_pct ?? 0), 0) / results.length
  const color = avg >= 75 ? 'text-emerald-500' : avg >= 50 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <TrendUp size={20} className="text-primary" weight="fill" />
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-xs text-muted-foreground">Average score across {results.length} test{results.length !== 1 ? 's' : ''}</span>
        <span className={`font-heading text-2xl font-bold tabular-nums ${color}`}>{Math.round(avg)}%</span>
      </div>
    </div>
  )
}

export function ProgressClient({ results }: { results: TestResult[] }) {
  if (results.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <ChartBar size={36} className="text-muted-foreground/40" />
        <p className="font-heading text-lg font-semibold text-foreground">Progress</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Take a practice quiz or simulated exam from the Courses tab. Your scores and mastery trends will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your practice test history and mastery trends.</p>
        </div>

        <AverageScore results={results} />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Test History</h2>
          <StaggerList className="flex flex-col gap-2">
            {results.map(r => (
              <StaggerItem key={r.result_id}>
                <TestResultRow result={r} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </div>
    </div>
  )
}
