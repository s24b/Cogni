import { createClient } from '@/lib/supabase/server'
import { runFlashcardAgent } from '@/lib/agents/flashcard'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, topicId } = await request.json() as { courseId: string; topicId: string }
  if (!courseId || !topicId) return NextResponse.json({ error: 'Missing courseId or topicId' }, { status: 400 })

  const result = await runFlashcardAgent(user.id, courseId, topicId)

  if (result.error && result.generated === 0) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, generated: result.generated })
}
