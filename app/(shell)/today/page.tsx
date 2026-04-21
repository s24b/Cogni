import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { runScheduler, generateUpcomingPreview } from '@/lib/agents/scheduler'
import { runNudgeChecks, getTopNudge } from '@/lib/agents/nudge'
import { getUserApiKey } from '@/lib/vault'
import { TodayClient } from './_client'
import type { TaskItem } from '@/lib/agents/scheduler'
import type { ActiveNudge } from '@/lib/agents/nudge'

export const dynamic = 'force-dynamic'

function greeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${time}, ${name}`
}

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: userRow },
    { data: plan },
    { data: inboxPending },
    apiKey,
    { data: courses },
  ] = await Promise.all([
    service.from('users').select('display_name, study_streak, last_study_date').eq('user_id', user.id).single(),
    service.from('study_plan').select('tasks').eq('user_id', user.id).eq('plan_date', today).single(),
    service.from('inbox_items').select('inbox_item_id').eq('user_id', user.id).in('classification_status', ['pending', 'unassigned']),
    getUserApiKey(user.id),
    service.from('courses').select('course_id, name').eq('user_id', user.id).eq('active_status', 'active'),
  ])

  // Detect active courses missing a syllabus (no Tier 1 material)
  const courseIds = (courses ?? []).map((c: { course_id: string }) => c.course_id)
  const { data: tier1Materials } = courseIds.length > 0
    ? await service.from('materials').select('course_id').eq('tier', 1).in('course_id', courseIds)
    : { data: [] as { course_id: string }[] }

  const coursesWithSyllabus = new Set((tier1Materials ?? []).map((m: { course_id: string }) => m.course_id))
  const missingSyllabus = (courses ?? []).filter(
    (c: { course_id: string; name: string }) => !coursesWithSyllabus.has(c.course_id)
  ) as { course_id: string; name: string }[]

  // Run nudge checks and fetch top nudge
  await runNudgeChecks(user.id)
  const activeNudge: ActiveNudge | null = await getTopNudge(user.id)

  // Auto-generate today's plan if none exists
  let tasks: TaskItem[] = []
  if (!plan) {
    await runScheduler(user.id)
    const { data: fresh } = await service
      .from('study_plan')
      .select('tasks')
      .eq('user_id', user.id)
      .eq('plan_date', today)
      .single()
    tasks = (fresh?.tasks as TaskItem[]) ?? []
  } else {
    tasks = (plan.tasks as TaskItem[]) ?? []
  }

  // Fire-and-forget: generate upcoming 6-day preview (skips days already cached)
  generateUpcomingPreview(user.id).catch(() => {})

  // Fetch next 6 days' plans for the weekly schedule section
  const upcomingDates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d.toISOString().split('T')[0]
  })

  const { data: upcomingPlans } = await service
    .from('study_plan')
    .select('plan_date, tasks')
    .eq('user_id', user.id)
    .in('plan_date', upcomingDates)
    .order('plan_date', { ascending: true })

  const upcomingSchedule = (upcomingPlans ?? []).map((p: { plan_date: string; tasks: TaskItem[] }) => ({
    date: p.plan_date,
    tasks: p.tasks as TaskItem[],
  }))

  return (
    <TodayClient
      greeting={greeting(userRow?.display_name ?? 'there')}
      tasks={tasks}
      upcomingSchedule={upcomingSchedule}
      pendingCount={inboxPending?.length ?? 0}
      streak={userRow?.study_streak ?? 0}
      hasApiKey={!!apiKey}
      missingSyllabus={missingSyllabus}
      activeNudge={activeNudge}
    />
  )
}
