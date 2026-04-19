import { createServiceClient } from '@/lib/supabase/server'
import { writeStudyBlocksToCalendar } from '@/lib/calendar'

export type TaskItem =
  | {
      type: 'flashcard_review'
      course_id: string
      course_name: string
      topic_ids: string[]
      card_count: number
      duration_minutes: number
      priority_score: number
      order: number
    }
  | {
      type: 'homework'
      course_id: string
      course_name: string
      assignment_id: string
      title: string
      due_date: string
      overdue: boolean
      order: number
    }

function examProximityMultiplier(daysToExam: number | null): number {
  if (daysToExam === null || daysToExam > 30) return 1
  if (daysToExam > 14) return 1.5
  if (daysToExam > 7) return 2
  if (daysToExam > 3) return 3
  return 5
}

export async function runScheduler(userId: string): Promise<void> {
  const service = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: userRow } = await service
    .from('users')
    .select('session_length_preference')
    .eq('user_id', userId)
    .single()

  const sessionMinutes = userRow?.session_length_preference ?? 45

  const { data: courses } = await service
    .from('courses')
    .select('course_id, name')
    .eq('user_id', userId)
    .eq('active_status', 'active')

  if (!courses || courses.length === 0) return

  const { data: exams } = await service
    .from('exams')
    .select('course_id, date')
    .eq('user_id', userId)
    .gte('date', today)
    .order('date', { ascending: true })

  const nextExamByCourse: Record<string, number> = {}
  for (const exam of exams ?? []) {
    const days = Math.ceil((new Date(exam.date).getTime() - Date.now()) / 86400000)
    if (!(exam.course_id in nextExamByCourse) || days < nextExamByCourse[exam.course_id]) {
      nextExamByCourse[exam.course_id] = days
    }
  }

  type CourseScore = {
    course_id: string
    course_name: string
    priority: number
    topic_ids: string[]
    card_count: number
  }

  const scored: CourseScore[] = []

  for (const course of courses) {
    const multiplier = examProximityMultiplier(nextExamByCourse[course.course_id] ?? null)

    const { data: topics } = await service
      .from('topics')
      .select('topic_id, professor_weight')
      .eq('course_id', course.course_id)

    if (!topics || topics.length === 0) continue

    const topicIds = topics.map((t: { topic_id: string; professor_weight: number }) => t.topic_id)

    const { data: mastery } = await service
      .from('topic_mastery')
      .select('topic_id, mastery_score')
      .eq('user_id', userId)
      .in('topic_id', topicIds)

    const masteryMap: Record<string, number> = {}
    for (const m of mastery ?? []) {
      masteryMap[m.topic_id] = Number(m.mastery_score ?? 0)
    }

    let totalPriority = 0
    for (const topic of topics) {
      const pw = Number(topic.professor_weight ?? 0.5)
      const ms = masteryMap[topic.topic_id] ?? 0
      const deficit = Math.max(0, pw - ms)
      totalPriority += deficit * pw * multiplier
    }
    const avgPriority = totalPriority / topics.length

    // Cards due today for this course
    const { data: dueCards } = await service
      .from('flashcards')
      .select('card_id, topic_id')
      .eq('user_id', userId)
      .eq('course_id', course.course_id)
      .lte('fsrs_next_review_date', today)

    const dueCount = dueCards?.length ?? 0
    const dueTopicIds = [...new Set((dueCards ?? []).map((c: { card_id: string; topic_id: string | null }) => c.topic_id).filter(Boolean) as string[])]

    if (dueCount === 0 && avgPriority < 0.01) continue

    scored.push({
      course_id: course.course_id,
      course_name: course.name,
      priority: avgPriority,
      topic_ids: dueTopicIds.length > 0 ? dueTopicIds : topicIds.slice(0, 5),
      card_count: dueCount,
    })
  }

  if (scored.length === 0) return

  const totalPriority = scored.reduce((sum, c) => sum + c.priority, 0)
  const tasks: TaskItem[] = []

  scored
    .sort((a, b) => b.priority - a.priority)
    .forEach((course, i) => {
      const share = totalPriority > 0 ? course.priority / totalPriority : 1 / scored.length
      const cappedShare = Math.min(0.7, Math.max(share, scored.length === 1 ? 1 : 0.1))
      const duration = Math.round(sessionMinutes * cappedShare)

      if (duration < 5) return

      tasks.push({
        type: 'flashcard_review',
        course_id: course.course_id,
        course_name: course.course_name,
        topic_ids: course.topic_ids,
        card_count: course.card_count,
        duration_minutes: duration,
        priority_score: Math.round(course.priority * 100) / 100,
        order: i + 1,
      })
    })

  // Homework blocks — due today or overdue, not yet completed
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: assignments } = await service
    .from('assignments')
    .select('assignment_id, title, due_date, course_id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('due_date', tomorrowStr)
    .order('due_date', { ascending: true })

  const courseNameMap: Record<string, string> = {}
  for (const c of courses) courseNameMap[c.course_id] = c.name

  let hwOrder = tasks.length + 1
  for (const a of assignments ?? []) {
    tasks.push({
      type: 'homework',
      course_id: a.course_id,
      course_name: courseNameMap[a.course_id] ?? '',
      assignment_id: a.assignment_id,
      title: a.title,
      due_date: a.due_date,
      overdue: a.due_date < today,
      order: hwOrder++,
    })
  }

  if (tasks.length === 0) return

  await service
    .from('study_plan')
    .upsert(
      { user_id: userId, plan_date: today, tasks, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,plan_date' }
    )

  console.log(`[scheduler] wrote ${tasks.length} task(s) for user ${userId} on ${today}`)

  // Write to Google Calendar if connected (fire-and-forget — don't block the plan)
  const calendarTasks = tasks.filter(t => t.type === 'flashcard_review') as Extract<TaskItem, { type: 'flashcard_review' }>[]
  writeStudyBlocksToCalendar(userId, calendarTasks).catch(e =>
    console.error('[scheduler] calendar write failed', e)
  )
}
