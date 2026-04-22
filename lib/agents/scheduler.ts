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
      completion_status?: 'pending' | 'complete' | 'late'
    }
  | {
      type: 'practice_quiz'
      course_id: string
      course_name: string
      reason: string
      order: number
    }
  | {
      type: 'insight'
      text: string
      order: number
    }

function examProximityMultiplier(daysToExam: number | null): number {
  if (daysToExam === null || daysToExam > 30) return 1
  if (daysToExam > 14) return 1.5
  if (daysToExam > 7) return 2
  if (daysToExam > 3) return 3
  return 5
}

function buildInsight(params: {
  courses: { name: string }[]
  nextExam: { courseName: string; daysAway: number } | null
  weakestTopic: { topicName: string; courseName: string; mastery: number } | null
  totalDueCards: number
  pendingHomework: number
}): string {
  const { nextExam, weakestTopic, totalDueCards, pendingHomework } = params

  if (nextExam && nextExam.daysAway <= 3) {
    return `Your ${nextExam.courseName} exam is in ${nextExam.daysAway} day${nextExam.daysAway === 1 ? '' : 's'} — focus everything there today.`
  }
  if (nextExam && nextExam.daysAway <= 7) {
    const weak = weakestTopic ? ` Start with ${weakestTopic.topicName}.` : ''
    return `${nextExam.courseName} exam in ${nextExam.daysAway} days — prioritize review sessions now.${weak}`
  }
  if (weakestTopic && weakestTopic.mastery < 0.3) {
    return `Your weakest area is ${weakestTopic.topicName} in ${weakestTopic.courseName} — it's a high-weight topic worth focusing on.`
  }
  if (pendingHomework > 0) {
    return `You have ${pendingHomework} assignment${pendingHomework > 1 ? 's' : ''} due — clear those first, then review your flashcards.`
  }
  if (totalDueCards > 20) {
    return `${totalDueCards} cards are due for review across your courses — a solid session today keeps you ahead.`
  }
  if (totalDueCards === 0) {
    return `You're all caught up on flashcards — great time to run a practice quiz and test your knowledge.`
  }
  return `Keep up your review habit — consistency is what drives long-term retention.`
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
    avg_mastery: number
    weakest_topic: { name: string; mastery: number } | null
  }

  const scored: CourseScore[] = []

  for (const course of courses) {
    const multiplier = examProximityMultiplier(nextExamByCourse[course.course_id] ?? null)

    const { data: topics } = await service
      .from('topics')
      .select('topic_id, name, professor_weight')
      .eq('course_id', course.course_id)

    if (!topics || topics.length === 0) continue

    const topicIds = topics.map((t: { topic_id: string; name: string; professor_weight: number }) => t.topic_id)

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
    let totalMastery = 0
    let weakestTopic: { name: string; mastery: number } | null = null

    for (const topic of topics as { topic_id: string; name: string; professor_weight: number }[]) {
      const pw = Number(topic.professor_weight ?? 0.5)
      const ms = masteryMap[topic.topic_id] ?? 0
      const deficit = Math.max(0, pw - ms)
      totalPriority += deficit * pw * multiplier
      totalMastery += ms
      if (pw >= 0.5 && (weakestTopic === null || ms < weakestTopic.mastery)) {
        weakestTopic = { name: topic.name, mastery: ms }
      }
    }
    const avgPriority = totalPriority / topics.length
    const avgMastery = totalMastery / topics.length

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
      avg_mastery: avgMastery,
      weakest_topic: weakestTopic,
    })
  }

  const tasks: TaskItem[] = []

  // Flashcard review blocks (only if courses have extracted topics)
  if (scored.length > 0) {
    const totalPriority = scored.reduce((sum, c) => sum + c.priority, 0)
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
  }

  // Practice quiz tasks — one per course where it makes sense
  const quizCandidates: { course_id: string; course_name: string; reason: string; priority: number }[] = []

  for (const course of courses) {
    const courseScore = scored.find(s => s.course_id === course.course_id)
    const daysToExam = nextExamByCourse[course.course_id] ?? null
    const avgMastery = courseScore?.avg_mastery ?? 0

    // Check last quiz date for this course
    const { data: lastQuiz } = await service
      .from('practice_test_results')
      .select('created_at')
      .eq('user_id', userId)
      .eq('course_id', course.course_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const daysSinceQuiz = lastQuiz
      ? Math.floor((Date.now() - new Date(lastQuiz.created_at).getTime()) / 86400000)
      : 999

    // Check if there are enough cards to quiz on
    const { count: cardCount } = await service
      .from('flashcards')
      .select('card_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('course_id', course.course_id)

    const hasEnoughCards = (cardCount ?? 0) >= 5

    const examSoon = daysToExam !== null && daysToExam <= 14
    const readyForQuiz = avgMastery >= 0.3 && daysSinceQuiz > 5 && hasEnoughCards

    if (examSoon || readyForQuiz) {
      let reason = ''
      if (daysToExam !== null && daysToExam <= 3) {
        reason = `Exam in ${daysToExam} day${daysToExam === 1 ? '' : 's'} — test yourself now`
      } else if (daysToExam !== null && daysToExam <= 7) {
        reason = `Exam in ${daysToExam} days — practice makes perfect`
      } else if (daysToExam !== null && daysToExam <= 14) {
        reason = `Exam coming up — check your retention`
      } else {
        reason = daysSinceQuiz > 14 ? `No quiz in ${daysSinceQuiz} days — time to test yourself` : `Mastery strong enough to test`
      }
      quizCandidates.push({
        course_id: course.course_id,
        course_name: course.name,
        reason,
        priority: daysToExam !== null ? (30 - daysToExam) : avgMastery * 10,
      })
    }
  }

  // Add quiz tasks (max 2)
  quizCandidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .forEach((c, i) => {
      tasks.push({
        type: 'practice_quiz',
        course_id: c.course_id,
        course_name: c.course_name,
        reason: c.reason,
        order: tasks.length + i + 1,
      })
    })

  // Homework blocks — due today or overdue, not yet completed
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: assignments } = await service
    .from('assignments')
    .select('assignment_id, name, due_date, course_id')
    .eq('user_id', userId)
    .eq('completion_status', 'pending')
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
      title: a.name,
      due_date: a.due_date,
      overdue: a.due_date < today,
      order: hwOrder++,
    })
  }

  if (tasks.length === 0) return

  // Build insight
  const nextExamEntry = Object.entries(nextExamByCourse).sort((a, b) => a[1] - b[1])[0]
  const nextExam = nextExamEntry
    ? { courseName: courseNameMap[nextExamEntry[0]] ?? 'Unknown', daysAway: nextExamEntry[1] }
    : null
  const overallWeakest = scored
    .flatMap(c => c.weakest_topic ? [{ topicName: c.weakest_topic.name, courseName: c.course_name, mastery: c.weakest_topic.mastery }] : [])
    .sort((a, b) => a.mastery - b.mastery)[0] ?? null
  const totalDueCards = scored.reduce((sum, c) => sum + c.card_count, 0)
  const pendingHomework = (assignments ?? []).length

  const insightText = buildInsight({
    courses,
    nextExam,
    weakestTopic: overallWeakest,
    totalDueCards,
    pendingHomework,
  })

  const allTasks: TaskItem[] = [
    { type: 'insight', text: insightText, order: 0 },
    ...tasks,
  ]

  await service
    .from('study_plan')
    .upsert(
      { user_id: userId, plan_date: today, tasks: allTasks, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,plan_date' }
    )

  console.log(`[scheduler] wrote ${allTasks.length} task(s) for user ${userId} on ${today}`)

  // Write to Google Calendar if connected
  const calendarTasks = tasks.filter(t => t.type === 'flashcard_review') as Extract<TaskItem, { type: 'flashcard_review' }>[]
  writeStudyBlocksToCalendar(userId, calendarTasks).catch(e =>
    console.error('[scheduler] calendar write failed', e)
  )
}

// Generates lightweight preview plans for the next 6 days (only if not already cached)
export async function generateUpcomingPreview(userId: string): Promise<void> {
  const service = createServiceClient()

  const { data: courses } = await service
    .from('courses')
    .select('course_id, name')
    .eq('user_id', userId)
    .eq('active_status', 'active')

  if (!courses || courses.length === 0) return

  const courseNameMap: Record<string, string> = {}
  for (const c of courses) courseNameMap[c.course_id] = c.name

  for (let dayOffset = 1; dayOffset <= 6; dayOffset++) {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    const dateStr = d.toISOString().split('T')[0]

    // Skip if plan already exists for this date
    const { data: existing } = await service
      .from('study_plan')
      .select('plan_id')
      .eq('user_id', userId)
      .eq('plan_date', dateStr)
      .single()

    if (existing) continue

    const tasks: TaskItem[] = []
    let order = 1

    // Cards due on this day
    for (const course of courses) {
      const { data: dueCards } = await service
        .from('flashcards')
        .select('card_id, topic_id')
        .eq('user_id', userId)
        .eq('course_id', course.course_id)
        .eq('fsrs_next_review_date', dateStr)

      const count = dueCards?.length ?? 0
      if (count === 0) continue

      const topicIds = [...new Set((dueCards ?? []).map((c: { topic_id: string | null }) => c.topic_id).filter(Boolean) as string[])]

      tasks.push({
        type: 'flashcard_review',
        course_id: course.course_id,
        course_name: course.name,
        topic_ids: topicIds,
        card_count: count,
        duration_minutes: Math.max(5, Math.round(count * 1.5)),
        priority_score: 0,
        order: order++,
      })
    }

    // Homework due on this day
    const dayEnd = new Date(d)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayEndStr = dayEnd.toISOString().split('T')[0]

    const { data: assignments } = await service
      .from('assignments')
      .select('assignment_id, name, due_date, course_id')
      .eq('user_id', userId)
      .eq('completion_status', 'pending')
      .gte('due_date', dateStr)
      .lt('due_date', dayEndStr)

    for (const a of assignments ?? []) {
      tasks.push({
        type: 'homework',
        course_id: a.course_id,
        course_name: courseNameMap[a.course_id] ?? '',
        assignment_id: a.assignment_id,
        title: a.name,
        due_date: a.due_date,
        overdue: false,
        order: order++,
      })
    }

    if (tasks.length === 0) continue

    await service
      .from('study_plan')
      .insert({ user_id: userId, plan_date: dateStr, tasks, generated_at: new Date().toISOString() })
      .then(() => {})
      .catch(() => {})
  }
}
