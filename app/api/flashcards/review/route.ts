import { createClient, createServiceClient } from '@/lib/supabase/server'
import { scheduleReview } from '@/lib/fsrs'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId, rating } = await request.json() as { cardId: string; rating: 1 | 2 | 3 | 4 }
  if (!cardId || !rating) return NextResponse.json({ error: 'Missing cardId or rating' }, { status: 400 })

  const service = createServiceClient()

  const { data: card, error: fetchError } = await service
    .from('flashcards')
    .select('fsrs_stability,fsrs_difficulty,fsrs_reps,fsrs_lapses,fsrs_state,fsrs_last_review,fsrs_next_review_date')
    .eq('card_id', cardId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const next = scheduleReview(card, rating)

  const { error: updateError } = await service
    .from('flashcards')
    .update(next)
    .eq('card_id', cardId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, next_review: next.fsrs_next_review_date })
}
