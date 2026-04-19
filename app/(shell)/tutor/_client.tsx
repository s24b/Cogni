'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import {
  PaperPlaneRight,
  Microphone,
  BookOpen,
  ChatCircle,
  Chalkboard,
  Crosshair,
  CircleNotch,
  Plus,
  ArrowsOut,
  ArrowsIn,
  Brain,
  Cards,
  Paperclip,
  Globe,
  X,
  CheckCircle,
  WarningCircle,
  MinusCircle,
} from '@phosphor-icons/react'
import { StaggerList, StaggerItem, ease } from '@/components/ui/motion'
import { BorderBeam } from 'border-beam'

type Course = { course_id: string; name: string; professors: { name: string }[] | { name: string } | null }
type Session = { session_id: string; course_id: string; name: string | null; mode: string; created_at: string }
type Mode = 'answer' | 'teach' | 'focus'
type InlineCard = { type: 'flashcards' | 'quiz'; count: number; topic: string; data?: object[] }
type LocalAttachment = { name: string; type: string; data: string; preview?: string }
type GradeResult = { score: number; rationale: string; topic: string }
type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  inlineCard?: InlineCard
  thinking?: string
  thinkingDone?: boolean
  searchQuery?: string
  searchDone?: boolean
  grade?: GradeResult
  attachments?: LocalAttachment[]
}

const MODES: { value: Mode; label: string; Icon: React.ElementType; tip: string; description: string }[] = [
  {
    value: 'answer',
    label: 'Answer',
    Icon: ChatCircle,
    tip: 'Direct, clear answers to your questions.',
    description: 'Answer mode — direct, concise responses to your questions.',
  },
  {
    value: 'teach',
    label: 'Teach',
    Icon: Chalkboard,
    tip: 'Guides you with questions instead of giving answers directly.',
    description: 'Teach mode — Socratic method. Expect questions back, not immediate answers.',
  },
  {
    value: 'focus',
    label: 'Focus',
    Icon: Crosshair,
    tip: 'Steers every response toward your weakest topics.',
    description: 'Focus mode — every response connects back to your weakest areas.',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function InlineCardChip({ card, onExpand }: { card: InlineCard; onExpand: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease }}
      className="mt-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5"
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
        <Cards size={15} className="text-primary" weight="fill" />
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-xs font-semibold text-foreground">
          {card.type === 'flashcards'
            ? `${card.count} flashcards — ${card.topic}`
            : `Quiz — ${card.topic} (${card.count} questions)`}
        </span>
        <span className="text-[10px] text-muted-foreground">Tap to expand</span>
      </div>
      <button
        onClick={onExpand}
        className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <ArrowsOut size={13} />
      </button>
    </motion.div>
  )
}

function SystemNotice({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease }}
      className="flex justify-center"
    >
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
        {content}
      </span>
    </motion.div>
  )
}

function ThinkingBlock({ thinking, done }: { thinking: string; done: boolean }) {
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (done) setExpanded(false)
  }, [done])

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease }}
      className="mb-2 w-full rounded-xl border border-violet-200/60 bg-violet-50/50 dark:border-violet-800/30 dark:bg-violet-950/20 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {done ? (
          <Brain size={13} className="shrink-0 text-violet-500" weight="fill" />
        ) : (
          <CircleNotch size={13} className="shrink-0 animate-spin text-violet-500" />
        )}
        <span className="flex-1 text-xs font-medium text-violet-700 dark:text-violet-400">
          {done ? 'Thought for a moment' : 'Thinking…'}
        </span>
        <span className="text-[10px] text-violet-400">{expanded ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && thinking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-violet-800/70 dark:text-violet-300/60 whitespace-pre-wrap">
              {thinking}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SearchBlock({ query, done }: { query: string; done: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease }}
      className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2"
    >
      <Globe
        size={13}
        weight={done ? 'regular' : 'fill'}
        className={`shrink-0 ${done ? 'text-muted-foreground' : 'text-primary'}`}
      />
      <span className="text-xs text-muted-foreground">
        {done ? 'Searched:' : 'Searching the web for:'}
      </span>
      <span className="flex-1 truncate text-xs font-medium text-foreground">{query}</span>
      {!done && <CircleNotch size={11} className="shrink-0 animate-spin text-muted-foreground" />}
    </motion.div>
  )
}

function GradeBlock({ grade }: { grade: GradeResult }) {
  const pct = Math.round(grade.score * 100)
  const isStrong = grade.score >= 0.7
  const isPartial = grade.score >= 0.4 && grade.score < 0.7
  const Icon = isStrong ? CheckCircle : isPartial ? MinusCircle : WarningCircle
  const colour = isStrong
    ? 'text-green-600 dark:text-green-400'
    : isPartial
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'
  const bg = isStrong
    ? 'bg-green-50 border-green-200/60 dark:bg-green-950/20 dark:border-green-800/30'
    : isPartial
    ? 'bg-amber-50 border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800/30'
    : 'bg-red-50 border-red-200/60 dark:bg-red-950/20 dark:border-red-800/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease }}
      className={`mt-2 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${bg}`}
    >
      <Icon size={15} weight="fill" className={`mt-0.5 shrink-0 ${colour}`} />
      <div className="flex flex-col gap-0.5">
        <span className={`text-xs font-semibold ${colour}`}>
          {grade.topic} — {pct}%
        </span>
        <span className="text-xs text-muted-foreground">{grade.rationale}</span>
      </div>
    </motion.div>
  )
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  if (streaming && !content) {
    return <CircleNotch size={14} className="animate-spin text-muted-foreground" />
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:font-semibold prose-headings:text-foreground prose-p:leading-relaxed prose-li:leading-relaxed prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.8em] prose-code:font-mono prose-code:text-foreground prose-pre:bg-transparent prose-pre:p-0 prose-strong:text-foreground prose-a:text-primary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="!rounded-xl !text-[0.8em]"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>{children}</code>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">{children}</table>
              </div>
            )
          },
          th({ children }) {
            return <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">{children}</th>
          },
          td({ children }) {
            return <td className="border border-border px-3 py-1.5">{children}</td>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── File helpers ──────────────────────────────────────────────────────────────

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
  })
}

// ── Main component ────────────────────────────────────────────────────────────

export function TutorClient({ courses, sessions }: { courses: Course[]; sessions: Session[] }) {
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('answer')
  const [deepThink, setDeepThink] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [splitContent, setSplitContent] = useState<InlineCard | null>(null)
  const [splitExpanded, setSplitExpanded] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close options panel on click outside
  useEffect(() => {
    if (!showOptions) return
    function handleClickOutside(e: MouseEvent) {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowOptions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOptions])

  // Auto-grow textarea
  function adjustTextareaHeight() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  async function handleFiles(files: FileList) {
    const newAtts: LocalAttachment[] = []
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const data = await readAsBase64(file)
        const preview = URL.createObjectURL(file)
        newAtts.push({ name: file.name, type: file.type, data, preview })
      } else if (
        file.type.startsWith('text/') ||
        /\.(txt|md|py|js|ts|json|csv|html|css)$/.test(file.name)
      ) {
        const data = await file.text()
        newAtts.push({ name: file.name, type: 'text/plain', data })
      }
    }
    setAttachments(prev => [...prev, ...newAtts])
  }

  function removeAttachment(i: number) {
    setAttachments(prev => {
      const next = [...prev]
      if (next[i].preview) URL.revokeObjectURL(next[i].preview!)
      next.splice(i, 1)
      return next
    })
  }

  function changeMode(newMode: Mode) {
    if (newMode === mode) return
    setMode(newMode)
    const def = MODES.find(m => m.value === newMode)
    if (def && activeCourse) {
      setMessages(prev => [...prev, { role: 'system', content: def.description }])
    }
  }

  function startNewSession(course: Course) {
    setActiveCourse(course)
    setActiveSessionId(null)
    setMessages([{ role: 'system', content: MODES.find(m => m.value === mode)!.description }])
    setInput('')
    setAttachments([])
    setSplitContent(null)
    setSplitExpanded(false)
  }

  async function loadSession(session: Session) {
    const course = courses.find(c => c.course_id === session.course_id)
    if (!course) return
    setActiveCourse(course)
    setActiveSessionId(session.session_id)
    setMode(session.mode as Mode)
    setMessages([])
    setAttachments([])
    setSplitContent(null)
    setSplitExpanded(false)

    // Fetch stored messages for this session
    try {
      const res = await fetch(`/api/agents/tutor?sessionId=${session.session_id}`)
      if (res.ok) {
        const { messages: stored } = await res.json() as {
          messages: { role: string; content: string }[]
        }
        setMessages(
          stored.map(m => ({ role: m.role as Message['role'], content: m.content }))
        )
      }
    } catch {
      // non-critical — leave messages empty
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeCourse || sending) return
    const text = input.trim()
    const sentAttachments = [...attachments]
    setInput('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setSending(true)

    const userMsg: Message = { role: 'user', content: text, attachments: sentAttachments }
    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      const res = await fetch('/api/agents/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourse.course_id,
          courseName: activeCourse.name,
          message: text,
          mode,
          deepThink,
          sessionId: activeSessionId,
          attachments: sentAttachments.map(a => ({ name: a.name, type: a.type, data: a.data })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.error ?? 'Something went wrong'}` }
          return updated
        })
        return
      }

      const newSessionId = res.headers.get('X-Session-Id')
      if (newSessionId && !activeSessionId) setActiveSessionId(newSessionId)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ''
      let accumulated = ''
      let thinkBuffer = ''
      let searchQuery = ''
      let cardPayload: InlineCard | undefined
      let gradeResult: GradeResult | undefined

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          lineBuffer += decoder.decode(value, { stream: true })
          const lines = lineBuffer.split('\n')
          lineBuffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line) as {
                t: string; c?: string; q?: string
                kind?: 'flashcards' | 'quiz'; topic?: string; count?: number; data?: object[]
                score?: number; rationale?: string
              }

              if (event.t === 'text' && event.c) {
                accumulated += event.c
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: accumulated,
                    streaming: true,
                    thinking: thinkBuffer || undefined,
                    thinkingDone: true,
                    searchQuery: searchQuery || undefined,
                    searchDone: true,
                    grade: gradeResult,
                  }
                  return updated
                })
              } else if (event.t === 'think' && event.c) {
                thinkBuffer += event.c
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    thinking: thinkBuffer,
                    thinkingDone: false,
                  }
                  return updated
                })
              } else if (event.t === 'search' && event.q) {
                searchQuery = event.q
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    searchQuery,
                    searchDone: false,
                  }
                  return updated
                })
              } else if (event.t === 'card' && event.kind) {
                cardPayload = {
                  type: event.kind,
                  count: event.count ?? 0,
                  topic: event.topic ?? '',
                  data: event.data,
                }
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    inlineCard: cardPayload,
                  }
                  return updated
                })
                setSplitContent(cardPayload)
              } else if (event.t === 'grade' && event.score !== undefined) {
                gradeResult = {
                  score: event.score,
                  rationale: event.rationale ?? '',
                  topic: event.topic ?? '',
                }
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    grade: gradeResult,
                  }
                  return updated
                })
              }
            } catch {
              // non-JSON line, ignore
            }
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: accumulated,
          thinking: thinkBuffer || undefined,
          thinkingDone: true,
          searchQuery: searchQuery || undefined,
          searchDone: true,
          inlineCard: cardPayload,
          grade: gradeResult,
        }
        return updated
      })
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => setInput((p: string) => p + e.results[0][0].transcript)
    rec.start()
  }

  // ── Course picker ─────────────────────────────────────────────────────────
  if (!activeCourse) {
    return (
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Tutor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a course to start a session.</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Your courses</p>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses yet.</p>
          ) : (
            <StaggerList className="flex flex-col gap-2">
              {courses.map(course => (
                <StaggerItem key={course.course_id}>
                  <motion.button
                    onClick={() => startNewSession(course)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.1 }}
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen size={16} className="text-primary" weight="fill" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{course.name}</span>
                  </motion.button>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </div>

        {sessions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Recent sessions</p>
            <StaggerList className="flex flex-col gap-2">
              {sessions.slice(0, 5).map(session => (
                <StaggerItem key={session.session_id}>
                  <motion.button
                    onClick={() => loadSession(session)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.1 }}
                  >
                    <ChatCircle size={16} className="shrink-0 text-muted-foreground" />
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="truncate text-sm text-foreground">{session.name ?? 'Unnamed session'}</span>
                      <span className="text-xs text-muted-foreground">
                        {courses.find(c => c.course_id === session.course_id)?.name ?? ''}
                      </span>
                    </div>
                  </motion.button>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        )}
      </div>
    )
  }

  // ── Active session ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel */}
      <motion.div
        className="flex min-h-0 flex-col"
        animate={{ width: splitExpanded ? '38%' : '100%' }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ minWidth: 0 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={() => setActiveCourse(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← Courses
          </button>
          <span className="flex-1 truncate text-sm font-semibold text-foreground">{activeCourse.name}</span>
          {(() => {
            const m = MODES.find(m => m.value === mode)!
            return (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground shrink-0">
                <m.Icon size={11} weight="fill" />
                {m.label}
              </span>
            )
          })()}
          <button
            onClick={() => startNewSession(activeCourse)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus size={12} weight="bold" />
            New
          </button>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-10 py-6">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center"
            >
              <BookOpen size={32} className="text-muted-foreground/40" weight="fill" />
              <p className="text-sm text-muted-foreground">Ask anything about {activeCourse.name}.</p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease }}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : msg.role === 'system' ? 'items-center' : 'items-start'
                }`}
              >
                {msg.role === 'system' ? (
                  <SystemNotice content={msg.content} />
                ) : msg.role === 'user' ? (
                  <div className="flex flex-col items-end gap-1.5">
                    {/* Attached file chips */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {msg.attachments.map((att, j) => (
                          <div key={j} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-1">
                            {att.preview ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={att.preview} alt={att.name} className="size-3.5 rounded object-cover" />
                            ) : (
                              <Paperclip size={11} className="text-muted-foreground" />
                            )}
                            <span className="max-w-28 truncate text-[10px] text-muted-foreground">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* Assistant message */
                  <div className="flex w-full flex-col items-start gap-2">
                    {msg.thinking && (
                      <ThinkingBlock thinking={msg.thinking} done={!!msg.thinkingDone} />
                    )}
                    {msg.searchQuery && (
                      <SearchBlock query={msg.searchQuery} done={!!msg.searchDone} />
                    )}
                    {/* Show bubble when content exists OR nothing else is showing */}
                    {(msg.content || (!msg.thinking && !msg.searchQuery)) && (
                      <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-3">
                        <AssistantMessage
                          content={msg.content}
                          streaming={msg.streaming && !msg.thinking && !msg.searchQuery}
                        />
                      </div>
                    )}
                    {msg.inlineCard && (
                      <InlineCardChip card={msg.inlineCard} onExpand={() => setSplitExpanded(true)} />
                    )}
                    {msg.grade && (
                      <GradeBlock grade={msg.grade} />
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Prompt bar — sticky at bottom */}
        <div className="flex flex-col items-center px-4 pb-4 pt-2 bg-background border-t border-transparent">
          <div className="w-full max-w-2xl">

            {/* Attached file chips */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs">
                    {att.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.preview} alt={att.name} className="size-4 rounded object-cover" />
                    ) : (
                      <Paperclip size={12} className="text-muted-foreground" />
                    )}
                    <span className="max-w-28 truncate text-foreground">{att.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input bar wrapper — relative so options panel can float above */}
            <div className="relative" ref={inputWrapperRef}>
              {/* Options panel — absolute, floats above input bar */}
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.18, ease }}
                    className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-border bg-card p-4 shadow-lg"
                  >
                    {/* Deep Think row */}
                    <button
                      onClick={() => setDeepThink(p => !p)}
                      className="flex w-full items-center justify-between rounded-xl px-1 py-1 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex size-8 items-center justify-center rounded-lg transition-colors ${deepThink ? 'bg-violet-100 dark:bg-violet-950' : 'bg-muted'}`}>
                          <Brain
                            size={15}
                            weight={deepThink ? 'fill' : 'regular'}
                            className={deepThink ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}
                          />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium text-foreground">Deep Think</span>
                          <span className="text-[11px] text-muted-foreground">Uses Opus 4.7 — slower but more thorough</span>
                        </div>
                      </div>
                      <div className={`h-5 w-9 rounded-full transition-colors ${deepThink ? 'bg-violet-500' : 'bg-muted-foreground/30'}`}>
                        <div className={`mt-0.5 size-4 rounded-full bg-white shadow transition-transform ${deepThink ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </button>

                    <div className="my-3 h-px bg-border" />

                    <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Mode</p>
                    <div className="flex flex-col gap-1">
                      {MODES.map(m => (
                        <button
                          key={m.value}
                          onClick={() => { changeMode(m.value); setShowOptions(false) }}
                          className={`flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                            mode === m.value ? 'bg-primary/10' : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className={`flex size-7 items-center justify-center rounded-lg ${mode === m.value ? 'bg-primary/10' : 'bg-muted'}`}>
                            <m.Icon
                              size={13}
                              weight={mode === m.value ? 'fill' : 'regular'}
                              className={mode === m.value ? 'text-primary' : 'text-muted-foreground'}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-semibold ${mode === m.value ? 'text-primary' : 'text-foreground'}`}>{m.label}</span>
                            <span className="text-[11px] text-muted-foreground">{m.tip}</span>
                          </div>
                          {mode === m.value && <div className="ml-auto size-2 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input bar */}
              <BorderBeam
                size="md"
                colorVariant="ocean"
                duration={1.96}
                strength={0.5}
                active={deepThink}
              >
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                {/* Left controls — plus and paperclip grouped */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setShowOptions(p => !p)}
                    className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                      showOptions ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <Plus size={16} weight={showOptions ? 'bold' : 'regular'} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.txt,.md,.py,.js,.ts,.json,.csv,.html,.css"
                    className="hidden"
                    onChange={e => e.target.files && handleFiles(e.target.files)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <Paperclip size={16} />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${activeCourse.name}…`}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none self-center leading-relaxed overflow-y-auto"
                  style={{ maxHeight: 160 }}
                />

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={startVoice}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <Microphone size={16} />
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    {sending
                      ? <CircleNotch size={15} className="animate-spin" />
                      : <PaperPlaneRight size={15} weight="fill" />
                    }
                  </button>
                </div>
              </div>
              </BorderBeam>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Split content panel */}
      <AnimatePresence>
        {splitExpanded && splitContent && (
          <motion.div
            key="split"
            initial={{ opacity: 0, x: 40, width: 0 }}
            animate={{ opacity: 1, x: 0, width: '62%' }}
            exit={{ opacity: 0, x: 40, width: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col border-l border-border overflow-hidden"
            style={{ minWidth: 0 }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Cards size={14} className="text-primary" weight="fill" />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground">
                {splitContent.type === 'flashcards' ? `Flashcards — ${splitContent.topic}` : `Quiz — ${splitContent.topic}`}
              </span>
              <button
                onClick={() => setSplitExpanded(false)}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <ArrowsIn size={14} />
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                <Cards size={28} className="text-primary" weight="fill" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {splitContent.type === 'flashcards'
                  ? `${splitContent.count} flashcards ready`
                  : `${splitContent.count} questions ready`}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Full review UI coming soon. Content is saved.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
