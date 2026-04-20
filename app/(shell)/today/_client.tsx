'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Tray,
  ArrowRight,
  Cards,
  BookOpen,
  CheckCircle,
  Fire,
  Warning,
  Key,
  ClockCountdown,
  GraduationCap,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem, ease } from '@/components/ui/motion'
import type { TaskItem } from '@/lib/agents/scheduler'
import type { ActiveNudge } from '@/lib/agents/nudge'

const COURSE_COLORS = [
  { bg: 'bg-blue-500/10', icon: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-violet-500/10', icon: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-amber-500/10', icon: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-rose-500/10', icon: 'text-rose-600 dark:text-rose-400' },
]

function FlashcardTaskCard({ task, index, completed, onComplete }: {
  task: Extract<TaskItem, { type: 'flashcard_review' }>
  index: number
  completed: boolean
  onComplete: () => void
}) {
  const color = COURSE_COLORS[index % COURSE_COLORS.length]
  return (
    <motion.div
      layout
      className={`rounded-xl border border-border bg-card transition-opacity ${completed ? 'opacity-50' : ''}`}
      whileHover={completed ? {} : { scale: 1.003, transition: { duration: 0.15, ease } }}
      whileTap={completed ? {} : { scale: 0.997 }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${color.bg}`}>
          <Cards size={18} className={color.icon} weight="fill" />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{task.course_name}</span>
          <span className="text-xs text-muted-foreground">
            {task.card_count > 0 ? `${task.card_count} cards due` : 'Flashcard review'} · ~{task.duration_minutes} min
          </span>
        </div>
        {completed ? (
          <CheckCircle size={22} className="shrink-0 text-emerald-500" weight="fill" />
        ) : task.card_count > 0 ? (
          <Link
            href={`/review?course=${task.course_id}`}
            onClick={onComplete}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            Study <ArrowRight size={13} />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">No cards yet</span>
        )}
      </div>
    </motion.div>
  )
}

function NudgeCard({ nudge, onDismiss }: { nudge: ActiveNudge; onDismiss: () => void }) {
  const [loading, setLoading] = useState(false)

  const iconMap: Record<string, React.ReactNode> = {
    homework_completion: <ClockCountdown size={16} className="text-red-500" weight="fill" />,
    material_gap: <BookOpen size={16} className="text-amber-500" weight="fill" />,
    upload_content: <UploadSimple size={16} className="text-amber-500" weight="fill" />,
  }
  const bgMap: Record<string, string> = {
    homework_completion: 'bg-red-500/10',
    material_gap: 'bg-amber-500/10',
    upload_content: 'bg-amber-500/10',
  }
  const borderMap: Record<string, string> = {
    homework_completion: 'border-red-200 dark:border-red-900/40',
    material_gap: 'border-amber-200 dark:border-amber-900/40',
    upload_content: 'border-amber-200 dark:border-amber-900/40',
  }

  const icon = iconMap[nudge.type] ?? <Warning size={16} className="text-muted-foreground" weight="fill" />
  const bg = bgMap[nudge.type] ?? 'bg-muted/40'
  const border = borderMap[nudge.type] ?? 'border-border'

  async function handleAction(action: 'resolve' | 'snooze') {
    setLoading(true)
    try {
      await fetch(`/api/nudges/${nudge.nudge_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      onDismiss()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${border}`}>
      <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        {icon}
      </div>
      <span className="flex-1 text-sm text-foreground leading-snug">{nudge.content}</span>
      {nudge.tier !== 'critical' && (
        <button
          disabled={loading}
          onClick={() => handleAction(nudge.tier === 'recurring' ? 'resolve' : 'snooze')}
          aria-label={nudge.tier === 'recurring' ? 'Mark done' : 'Snooze'}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

function HomeworkTaskCard({ task, index, completed, onComplete }: {
  task: Extract<TaskItem, { type: 'homework' }>
  index: number
  completed: boolean
  onComplete: () => void
}) {
  const color = COURSE_COLORS[index % COURSE_COLORS.length]
  return (
    <motion.div
      layout
      className={`rounded-xl border transition-opacity ${
        task.overdue
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-border bg-card'
      } ${completed ? 'opacity-50' : ''}`}
      whileHover={completed ? {} : { scale: 1.003, transition: { duration: 0.15, ease } }}
      whileTap={completed ? {} : { scale: 0.997 }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${task.overdue ? 'bg-red-500/10' : color.bg}`}>
          <ClockCountdown size={18} className={task.overdue ? 'text-red-500' : color.icon} weight="fill" />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{task.title}</span>
          <span className={`text-xs ${task.overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
            {task.overdue ? 'Overdue · ' : 'Due today · '}{task.course_name}
          </span>
        </div>
        {completed ? (
          <CheckCircle size={22} className="shrink-0 text-emerald-500" weight="fill" />
        ) : (
          <button
            onClick={onComplete}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors shrink-0"
          >
            Done <CheckCircle size={13} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function TodayClient({
  greeting,
  tasks,
  pendingCount,
  streak,
  hasApiKey,
  missingSyllabus,
  activeNudge: initialNudge,
}: {
  greeting: string
  tasks: TaskItem[]
  pendingCount: number
  streak: number
  hasApiKey: boolean
  missingSyllabus: { course_id: string; name: string }[]
  activeNudge: ActiveNudge | null
}) {
  const router = useRouter()
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [activeNudge, setActiveNudge] = useState<ActiveNudge | null>(initialNudge)

  const studyTasks = tasks.filter(t => t.type === 'flashcard_review') as Extract<TaskItem, { type: 'flashcard_review' }>[]
  const hwTasks = tasks.filter(t => t.type === 'homework') as Extract<TaskItem, { type: 'homework' }>[]
  const completedCount = completed.size
  const total = tasks.length

  function markDone(globalIdx: number) {
    setCompleted(prev => new Set([...prev, globalIdx]))
    fetch('/api/user/streak', { method: 'POST' }).then(() => router.refresh()).catch(() => {})
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Header + streak */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{greeting}</h1>
          {total > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {completedCount === total
                ? "You're all done for today."
                : `${total - completedCount} task${total - completedCount === 1 ? '' : 's'} left today.`}
            </p>
          )}
        </div>
        {streak > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <Fire size={14} className="text-amber-500" weight="fill" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${(completedCount / total) * 100}%` }}
              transition={{ duration: 0.4, ease }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">{completedCount}/{total}</span>
        </div>
      )}

      {/* System state: API key missing (undismissable) */}
      {!hasApiKey && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <Key size={18} className="shrink-0 text-red-500" weight="fill" />
          <div className="flex flex-1 flex-col min-w-0">
            <span className="text-sm font-semibold text-red-800 dark:text-red-300">Anthropic API key missing</span>
            <span className="text-xs text-red-600/80 dark:text-red-400/80">AI features are disabled until you add a key in Settings.</span>
          </div>
          <Link
            href="/settings"
            className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 transition-colors dark:bg-red-900/40 dark:text-red-300"
          >
            Fix
          </Link>
        </div>
      )}

      {/* System state: syllabus missing per course (undismissable) */}
      {missingSyllabus.map(course => (
        <div key={course.course_id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <Warning size={18} className="shrink-0 text-amber-500" weight="fill" />
          <div className="flex flex-1 flex-col min-w-0">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 truncate">{course.name} — no syllabus</span>
            <span className="text-xs text-amber-600/80 dark:text-amber-400/80">Upload a syllabus so Cogni can build your study plan.</span>
          </div>
          <Link
            href="/inbox"
            className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition-colors dark:bg-amber-900/40 dark:text-amber-300"
          >
            Upload
          </Link>
        </div>
      ))}

      {/* Nudge card */}
      {activeNudge && (
        <NudgeCard nudge={activeNudge} onDismiss={() => setActiveNudge(null)} />
      )}

      {/* Inbox nudge */}
      {pendingCount > 0 && (
        <Link
          href="/inbox"
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 hover:bg-muted/60 transition-colors"
        >
          <Tray size={18} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm text-foreground">
            {pendingCount} inbox item{pendingCount > 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} review
          </span>
          <ArrowRight size={16} className="text-muted-foreground" />
        </Link>
      )}

      {/* Study tasks */}
      {studyTasks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={14} className="text-muted-foreground" weight="fill" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Study</h2>
          </div>
          <StaggerList className="flex flex-col gap-3">
            {studyTasks.sort((a, b) => a.order - b.order).map((task, i) => (
              <StaggerItem key={task.course_id}>
                <FlashcardTaskCard
                  task={task}
                  index={i}
                  completed={completed.has(tasks.indexOf(task))}
                  onComplete={() => markDone(tasks.indexOf(task))}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {/* Homework tasks */}
      {hwTasks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ClockCountdown size={14} className="text-muted-foreground" weight="fill" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Homework</h2>
          </div>
          <StaggerList className="flex flex-col gap-3">
            {hwTasks.sort((a, b) => a.order - b.order).map((task, i) => (
              <StaggerItem key={task.assignment_id}>
                <HomeworkTaskCard
                  task={task}
                  index={i}
                  completed={completed.has(tasks.indexOf(task))}
                  onComplete={() => markDone(tasks.indexOf(task))}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && missingSyllabus.length === 0 && hasApiKey && !activeNudge && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <BookOpen size={36} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">You&apos;re all caught up for today.</p>
          <p className="text-xs text-muted-foreground/60">New cards and assignments will appear here when they&apos;re due.</p>
        </div>
      )}
    </div>
  )
}
