'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  CircleNotch,
  Timer,
  Trophy,
  ArrowLeft,
  ClipboardText,
} from '@phosphor-icons/react'
import { ease } from '@/components/ui/motion'
import type { QuizQuestion, GradeSummary } from '@/lib/agents/practice-quiz'

export type { QuizQuestion }

type QuizFormat = 'mc' | 'short_answer' | 'mixed'

type ConfigState = {
  topicFilter: string
  format: QuizFormat
  questionCount: number
}

type QuizState = 'config' | 'loading' | 'quiz' | 'grading' | 'results'

type Props = {
  courseId: string
  courseName: string
  // Pre-loaded questions (from tutor's create_quiz). If provided, skip config.
  initialQuestions?: QuizQuestion[]
  examMode?: boolean         // adds countdown timer, no-pause, Sonnet-generated
  onClose?: () => void
  // Called after results are shown, if parent wants to react
  onComplete?: (summary: GradeSummary) => void
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }}
        transition={{ duration: 0.3, ease }}
      />
    </div>
  )
}

function CountdownTimer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds)
  const expiredRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id)
          if (!expiredRef.current) {
            expiredRef.current = true
            onExpire()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [onExpire])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const urgent = remaining < 300  // last 5 minutes

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold tabular-nums ${urgent ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
      <Timer size={12} weight={urgent ? 'fill' : 'regular'} />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  )
}

function ConfigForm({
  courseName,
  onStart,
  loading,
  examMode,
}: {
  courseName: string
  onStart: (cfg: ConfigState) => void
  loading: boolean
  examMode?: boolean
}) {
  const [format, setFormat] = useState<QuizFormat>('mc')
  const [questionCount, setQuestionCount] = useState(10)
  const [topicFilter, setTopicFilter] = useState('')

  const formats: { value: QuizFormat; label: string; desc: string }[] = [
    { value: 'mc', label: 'Multiple Choice', desc: 'Tap to select the correct answer' },
    { value: 'short_answer', label: 'Short Answer', desc: 'Type your answer in your own words' },
    { value: 'mixed', label: 'Mixed', desc: 'Combination of both types' },
  ]

  const counts = [5, 10, 15, 20]

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {examMode ? 'Simulated Exam' : 'Practice Quiz'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {examMode
              ? `AI-generated exam for ${courseName} matching your professor's style and timing.`
              : `Custom quiz for ${courseName}. Weighted toward your weakest topics.`
            }
          </p>
        </div>

        {!examMode && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Topic (optional)</label>
              <input
                type="text"
                value={topicFilter}
                onChange={e => setTopicFilter(e.target.value)}
                placeholder="e.g. Derivatives, Integration…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground">Leave blank to draw from all topics, weighted toward weak areas.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Format</label>
              <div className="grid grid-cols-1 gap-2">
                {formats.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      format === f.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Questions</label>
              <div className="flex gap-2">
                {counts.map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      questionCount === n
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {examMode && (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p>The exam will be timed based on your course exam duration. Once started, it cannot be paused. Questions are generated to match your professor&apos;s style.</p>
          </div>
        )}

        <button
          onClick={() => onStart({ topicFilter, format, questionCount })}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <CircleNotch size={16} className="animate-spin" />
              Generating questions…
            </>
          ) : (
            <>
              {examMode ? 'Start Exam' : 'Start Quiz'}
              <ArrowRight size={16} weight="bold" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function QuestionCard({
  question,
  index,
  total,
  onAnswer,
}: {
  question: QuizQuestion
  index: number
  total: number
  onAnswer: (answer: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [shortAnswer, setShortAnswer] = useState('')
  const confirmed = question.type === 'mc' ? selected !== null : false

  function handleNext() {
    if (question.type === 'mc' && selected) {
      onAnswer(selected)
    } else if (question.type === 'short_answer') {
      onAnswer(shortAnswer)
    }
    setSelected(null)
    setShortAnswer('')
  }

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22, ease }}
      className="flex flex-1 flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{question.topic_name}</span>
        <span>·</span>
        <span>Question {index + 1} of {total}</span>
      </div>

      <p className="text-base font-medium text-foreground leading-relaxed">{question.question}</p>

      {question.type === 'mc' && question.options && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelected(opt)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                selected === opt
                  ? 'border-primary bg-primary/8 text-primary font-medium'
                  : 'border-border text-foreground hover:border-primary/40 hover:bg-muted/30'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === 'short_answer' && (
        <textarea
          value={shortAnswer}
          onChange={e => setShortAnswer(e.target.value)}
          placeholder="Type your answer…"
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )}

      <div className="mt-auto">
        <button
          onClick={handleNext}
          disabled={question.type === 'mc' ? !selected : shortAnswer.trim().length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {index < total - 1 ? 'Next' : 'Submit'}
          <ArrowRight size={15} weight="bold" />
        </button>
        {question.type === 'short_answer' && index < total - 1 && (
          <button
            onClick={() => onAnswer('')}
            className="mt-2 w-full rounded-xl py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip this question
          </button>
        )}
      </div>
    </motion.div>
  )
}

function ResultsScreen({
  questions,
  userAnswers,
  summary,
  onRetry,
  onClose,
}: {
  questions: QuizQuestion[]
  userAnswers: string[]
  summary: GradeSummary
  onRetry?: () => void
  onClose?: () => void
}) {
  const [showReview, setShowReview] = useState(false)
  const { correctCount, scorePct, missedTopics, masteryUpdates } = summary

  const scoreColor = scorePct >= 75 ? 'text-emerald-500' : scorePct >= 50 ? 'text-amber-500' : 'text-red-500'
  const scoreBg = scorePct >= 75 ? 'bg-emerald-500/10' : scorePct >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-5 p-5">
        {/* Score hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease }}
          className={`flex flex-col items-center gap-2 rounded-2xl ${scoreBg} py-8`}
        >
          <Trophy size={32} className={scoreColor} weight="fill" />
          <div className={`font-heading text-5xl font-bold tabular-nums ${scoreColor}`}>
            {Math.round(scorePct)}%
          </div>
          <p className="text-sm text-muted-foreground">
            {correctCount} of {questions.length} correct
          </p>
        </motion.div>

        {/* Mastery updates */}
        {masteryUpdates.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mastery Updated</p>
            <div className="flex flex-col gap-1.5">
              {masteryUpdates.map((u, i) => {
                const delta = u.newScore - u.oldScore
                return (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="text-sm text-foreground truncate">{u.topicName}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${u.newScore >= 0.75 ? 'bg-emerald-500' : u.newScore >= 0.4 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${Math.round(u.newScore * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(u.newScore * 100)}%</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium tabular-nums ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {delta >= 0 ? '+' : ''}{Math.round(delta * 100)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Missed topics */}
        {missedTopics.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Focus Areas</p>
            <div className="flex flex-wrap gap-1.5">
              {missedTopics.map((m, i) => (
                <span key={i} className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-500">
                  {m.topic} ({m.wrongCount} wrong)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Answer review toggle */}
        <button
          onClick={() => setShowReview(v => !v)}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          <ClipboardText size={15} />
          {showReview ? 'Hide' : 'Review'} answers
        </button>

        {showReview && (
          <div className="flex flex-col gap-3">
            {questions.map((q, i) => {
              const ua = userAnswers[i] ?? ''
              const correct = ua.toLowerCase() === q.answer.toLowerCase() || (!ua && false)
              return (
                <div key={i} className={`rounded-xl border p-3.5 flex flex-col gap-2 ${correct ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                  <div className="flex items-start gap-2">
                    {correct
                      ? <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" weight="fill" />
                      : <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" weight="fill" />
                    }
                    <p className="text-sm text-foreground">{q.question}</p>
                  </div>
                  {!correct && ua && (
                    <p className="text-xs text-red-500 pl-6">Your answer: {ua}</p>
                  )}
                  <p className="text-xs text-muted-foreground pl-6">Correct: {q.answer}</p>
                  <p className="text-xs text-muted-foreground/70 pl-6 italic">{q.explanation}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
            >
              <ArrowLeft size={14} />
              New Quiz
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function QuizSession({ courseId, courseName, initialQuestions, examMode, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<QuizState>(initialQuestions ? 'quiz' : 'config')
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions ?? [])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [summary, setSummary] = useState<GradeSummary | null>(null)
  const [configState, setConfigState] = useState<ConfigState>({ topicFilter: '', format: 'mc', questionCount: 10 })
  const [examDuration, setExamDuration] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const onExpireRef = useRef<() => void>(() => {})

  const submitAnswers = useCallback(async (answers: string[], qs: QuizQuestion[]) => {
    setPhase('grading')
    try {
      const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined
      const res = await fetch('/api/agents/practice-quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          testType: examMode ? 'simulated_exam' : 'practice_quiz',
          questions: qs,
          userAnswers: answers,
          topicFilter: configState.topicFilter || undefined,
          durationSeconds,
        }),
      })
      const data = await res.json() as GradeSummary
      setSummary(data)
      setPhase('results')
      onComplete?.(data)
    } catch {
      setSummary({ correctCount: 0, scorePct: 0, missedTopics: [], masteryUpdates: [] })
      setPhase('results')
    }
  }, [courseId, examMode, configState.topicFilter, startTime, onComplete])

  onExpireRef.current = () => submitAnswers(userAnswers, questions)

  async function handleStart(cfg: ConfigState) {
    setConfigState(cfg)
    setPhase('loading')

    try {
      const endpoint = examMode ? '/api/agents/simulated-exam' : '/api/agents/practice-quiz'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          courseName,
          format: cfg.format,
          questionCount: cfg.questionCount,
          topicFilter: cfg.topicFilter || undefined,
        }),
      })
      const data = await res.json() as { questions: QuizQuestion[]; durationMinutes?: number }
      setQuestions(data.questions)
      if (data.durationMinutes) setExamDuration(data.durationMinutes * 60)
      setUserAnswers([])
      setCurrentIndex(0)
      setStartTime(Date.now())
      setPhase('quiz')
    } catch {
      setPhase('config')
    }
  }

  function handleAnswer(answer: string) {
    const newAnswers = [...userAnswers, answer]
    setUserAnswers(newAnswers)

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      submitAnswers(newAnswers, questions)
    }
  }

  function handleRetry() {
    setPhase('config')
    setQuestions([])
    setUserAnswers([])
    setCurrentIndex(0)
    setSummary(null)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-foreground">
            {examMode ? 'Simulated Exam' : 'Practice Quiz'}
          </span>
          <span className="text-xs text-muted-foreground truncate">{courseName}</span>
        </div>
        {phase === 'quiz' && (
          <div className="flex items-center gap-2 shrink-0">
            {examMode && examDuration > 0 && (
              <CountdownTimer
                totalSeconds={examDuration}
                onExpire={() => onExpireRef.current()}
              />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {phase === 'quiz' && questions.length > 0 && (
        <div className="px-4 pt-3 shrink-0">
          <ProgressBar current={currentIndex} total={questions.length} />
        </div>
      )}

      {/* Body */}
      <AnimatePresence mode="wait">
        {phase === 'config' && (
          <motion.div key="config" className="flex flex-1 flex-col overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ConfigForm courseName={courseName} onStart={handleStart} loading={false} examMode={examMode} />
          </motion.div>
        )}

        {phase === 'loading' && (
          <motion.div key="loading" className="flex flex-1 flex-col items-center justify-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CircleNotch size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating questions…</p>
          </motion.div>
        )}

        {phase === 'quiz' && questions[currentIndex] && (
          <motion.div key={`q-${currentIndex}`} className="flex flex-1 flex-col overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnimatePresence mode="wait">
              <QuestionCard
                key={currentIndex}
                question={questions[currentIndex]}
                index={currentIndex}
                total={questions.length}
                onAnswer={handleAnswer}
              />
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'grading' && (
          <motion.div key="grading" className="flex flex-1 flex-col items-center justify-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CircleNotch size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Grading your answers…</p>
          </motion.div>
        )}

        {phase === 'results' && summary && (
          <motion.div key="results" className="flex flex-1 flex-col overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultsScreen
              questions={questions}
              userAnswers={userAnswers}
              summary={summary}
              onRetry={!initialQuestions ? handleRetry : undefined}
              onClose={onClose}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
