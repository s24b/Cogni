'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import {
  ArrowLeft,
  ArrowRight,
  Cards,
  X,
} from '@phosphor-icons/react'
import { ease } from '@/components/ui/motion'

type Flashcard = { front: string; back: string; card_id?: string }

type Props = {
  cards: Flashcard[]
  topic: string
  onClose: () => void
}

const RATINGS = [
  { label: 'Again', value: 1 as const, color: 'bg-red-500 hover:bg-red-600 text-white' },
  { label: 'Hard',  value: 2 as const, color: 'bg-orange-400 hover:bg-orange-500 text-white' },
  { label: 'Good',  value: 3 as const, color: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  { label: 'Easy',  value: 4 as const, color: 'bg-blue-500 hover:bg-blue-600 text-white' },
]

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
  const [ratedMap, setRatedMap] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)

  // Reset when tutor regenerates the deck (new cards array from parent).
  const lastCardsRef = useRef(cards)
  useEffect(() => {
    if (cards !== lastCardsRef.current) {
      lastCardsRef.current = cards
      setIndex(0)
      setFlipped(false)
      setDirection(1)
      setRatedMap({})
    }
  }, [cards])

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

  async function handleRate(rating: 1 | 2 | 3 | 4) {
    if (submitting) return
    setRatedMap(prev => ({ ...prev, [index]: rating }))
    if (card.card_id) {
      setSubmitting(true)
      try {
        await fetch('/api/cards/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId: card.card_id, rating }),
        })
      } catch { /* non-critical */ }
      setSubmitting(false)
    }
    // Auto-advance after rating
    setTimeout(() => {
      if (index < cards.length - 1) {
        setDirection(1)
        setFlipped(false)
        setIndex(i => i + 1)
      }
    }, 300)
  }

  // Dot indicator — always show active dot for current index
  const maxDots = Math.min(cards.length, 7)
  const activeDot = cards.length <= maxDots
    ? index
    : Math.round((index / (cards.length - 1)) * (maxDots - 1))

  function dotTargetIndex(i: number) {
    return maxDots === cards.length ? i : Math.round((i / (maxDots - 1)) * (cards.length - 1))
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
          aria-label="Close flashcards"
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <X size={14} />
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
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.button
            key={`${index}-${flipped ? 'back' : 'front'}`}
            onClick={() => setFlipped(f => !f)}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.2, ease }}
            className="group relative flex w-full cursor-pointer select-none flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 shadow-sm hover:border-primary/30 hover:shadow-md transition-all"
            style={{ minHeight: 260 }}
          >
            <div className="absolute top-3 right-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${flipped ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                {flipped ? 'Back' : 'Front'}
              </span>
            </div>

            <div className={`text-center text-base font-medium leading-relaxed ${flipped ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
              <MathText text={flipped ? card.back : card.front} />
            </div>

            {!flipped && (
              <p className="absolute bottom-3 text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors">
                tap to reveal answer
              </p>
            )}
          </motion.button>
        </AnimatePresence>

        {/* Difficulty rating — only shown after flip */}
        <AnimatePresence>
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="flex w-full gap-2"
            >
              {RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => handleRate(r.value)}
                  disabled={submitting}
                  className={`flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                    ratedMap[index] === r.value
                      ? r.color + ' ring-2 ring-offset-1 ring-current'
                      : r.color
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </motion.div>
          )}
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

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxDots }, (_, i) => (
              <button
                key={i}
                onClick={() => { setFlipped(false); setIndex(dotTargetIndex(i)) }}
                className={`rounded-full transition-all duration-200 ${activeDot === i ? 'w-3 h-3 bg-primary' : 'w-2 h-2 bg-muted hover:bg-muted-foreground/40'}`}
              />
            ))}
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
