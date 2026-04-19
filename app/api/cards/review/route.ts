import { createClient, createServiceClient } from '@/lib/supabase/server'
import { scheduleReview } from '@/lib/fsrs'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { cardId, rating } = await request.json() as { cardId: string; rating: 1 | 2 | 3 | 4 }

  if (!cardId || ![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: card, error: cardError } = await service
    .from('flashcards')
    .select('card_id, topic_id, fsrs_stability, fsrs_difficulty, fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review, fsrs_next_review_date')
    .eq('card_id', cardId)
    .eq('user_id', user.id)
    .single()

  if (cardError || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  const next = scheduleReview({
    fsrs_stability: Number(card.fsrs_stability),
    fsrs_difficulty: Number(card.fsrs_difficulty),
    fsrs_reps: card.fsrs_reps,
    fsrs_lapses: card.fsrs_lapses,
    fsrs_state: card.fsrs_state,
    fsrs_last_review: card.fsrs_last_review,
    fsrs_next_review_date: card.fsrs_next_review_date,
  }, rating)

  const { error: updateError } = await service
    .from('flashcards')
    .update(next)
    .eq('card_id', cardId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Rough mastery bump: Again=-0.1, Hard=+0.02, Good=+0.08, Easy=+0.12. Clamped 0..1.
  if (card.topic_id) {
    const delta = rating === 1 ? -0.1 : rating === 2 ? 0.02 : rating === 3 ? 0.08 : 0.12

    const { data: mastery } = await service
      .from('topic_mastery')
      .select('mastery_score')
      .eq('user_id', user.id)
      .eq('topic_id', card.topic_id)
      .single()

    const current = Number(mastery?.mastery_score ?? 0)
    const newScore = Math.max(0, Math.min(1, current + delta))

    await service
      .from('topic_mastery')
      .update({ mastery_score: newScore, last_updated: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('topic_id', card.topic_id)
  }

  return NextResponse.json({ ok: true, nextDue: next.fsrs_next_review_date })
}
