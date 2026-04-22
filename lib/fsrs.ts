import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'

export { Rating }

const f = fsrs()

export function newCardDefaults() {
  const card = createEmptyCard()
  return dbFromCard(card)
}

export function scheduleReview(
  dbCard: {
    fsrs_stability: number
    fsrs_difficulty: number
    fsrs_reps: number
    fsrs_lapses: number
    fsrs_state: string
    fsrs_last_review: string | null
    fsrs_next_review_date: string
  },
  rating: 1 | 2 | 3 | 4
) {
  const stateMap: Record<string, number> = { new: 0, learning: 1, review: 2, relearning: 3 }
  const card: Card = {
    due: new Date(dbCard.fsrs_next_review_date),
    stability: dbCard.fsrs_stability,
    difficulty: dbCard.fsrs_difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: dbCard.fsrs_reps,
    lapses: dbCard.fsrs_lapses,
    learning_steps: 0,
    state: stateMap[dbCard.fsrs_state] ?? 0,
    last_review: dbCard.fsrs_last_review ? new Date(dbCard.fsrs_last_review) : undefined,
  }

  const now = new Date()
  const scheduling = f.repeat(card, now)
  // scheduling keys are '1'|'2'|'3'|'4' matching Rating enum values
  const next = (scheduling as unknown as Record<string, { card: Card }>)[String(rating)].card

  return dbFromCard(next)
}

function dbFromCard(card: Card) {
  const stateLabel = ['new', 'learning', 'review', 'relearning'][card.state] ?? 'new'
  return {
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    fsrs_last_review: card.last_review?.toISOString() ?? null,
    fsrs_next_review_date: card.due.toISOString().split('T')[0],
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_state: stateLabel,
  }
}
