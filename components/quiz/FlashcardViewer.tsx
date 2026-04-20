'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import {
  ArrowLeft,
  ArrowRight,
  ArrowsIn,
  Cards,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { ease } from '@/components/ui/motion'

type Flashcard = { front: string; back: string }

type Props = {
  cards: Flashcard[]
  topic: string
  onClose: () => void
}

function MathText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {text}
    </ReactMarkdown>
  )
}

export function FlashcardViewer({ cards, topic, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)

  const card = cards[index]

  function goNext() {
    if (index < cards.length - 1) {
      setDirection(1)
      setFlipped(false)
      setTimeout(() => setIndex(i => i + 1), 0)
    }
  }

  function goPrev() {
    if (index > 0) {
      setDirection(-1)
      setFlipped(false)
      setTimeout(() => setIndex(i => i - 1), 0)
    }
  }

  function handleFlip() {
    setFlipped(f => !f)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Cards size={14} className="text-primary" weight="fill" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground truncate">Flashcards — {topic}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{index + 1}/{cards.length}</span>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <ArrowsIn size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 shrink-0 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.button
            key={`${index}-${flipped ? 'back' : 'front'}`}
            onClick={handleFlip}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.2, ease }}
            className="group relative flex w-full max-w-sm cursor-pointer select-none flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/30 hover:shadow-md transition-all"
            style={{ minHeight: 200 }}
          >
            <div className="absolute top-3 right-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${flipped ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                {flipped ? 'Back' : 'Front'}
              </span>
            </div>

            <div className={`text-center text-sm font-medium leading-relaxed ${flipped ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
              <MathText text={flipped ? card.back : card.front} />
            </div>

            <div className="absolute bottom-3 flex items-center gap-1 text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors">
              <ArrowCounterClockwise size={10} />
              tap to {flipped ? 'see front' : 'reveal answer'}
            </div>
          </motion.button>
        </AnimatePresence>

        {/* Nav */}
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Dot indicators (show up to 7) */}
          <div className="flex items-center gap-1">
            {cards.slice(0, 7).map((_, i) => {
              const actual = cards.length > 7
                ? Math.round((i / 6) * (cards.length - 1))
                : i
              const active = actual === index
              return (
                <button
                  key={i}
                  onClick={() => { setFlipped(false); setIndex(actual) }}
                  className={`rounded-full transition-all ${active ? 'w-3 h-3 bg-primary' : 'w-2 h-2 bg-muted hover:bg-muted-foreground/40'}`}
                />
              )
            })}
          </div>

          <button
            onClick={goNext}
            disabled={index === cards.length - 1}
            className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
