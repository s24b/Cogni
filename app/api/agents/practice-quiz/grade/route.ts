import { createClient } from '@/lib/supabase/server'
import { getUserApiKey } from '@/lib/vault'
import { gradeAndRecord, type QuizQuestion } from '@/lib/agents/practice-quiz'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json() as {
    courseId: string
    testType: 'practice_quiz' | 'simulated_exam'
    questions: QuizQuestion[]
    userAnswers: string[]
    topicFilter?: string
    durationSeconds?: number
  }
  const { courseId, testType, questions, userAnswers, topicFilter, durationSeconds } = body

  if (!courseId || !questions?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = await getUserApiKey(user.id)

  try {
    const summary = await gradeAndRecord(
      user.id,
      courseId,
      testType,
      questions,
      userAnswers,
      topicFilter,
      durationSeconds,
      apiKey ?? undefined,
    )
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
