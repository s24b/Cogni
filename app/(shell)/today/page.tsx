import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { runScheduler } from '@/lib/agents/scheduler'
import { getUserApiKey } from '@/lib/vault'
import { TodayClient } from './_client'
import type { TaskItem } from '@/lib/agents/scheduler'

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

  return (
    <TodayClient
      greeting={greeting(userRow?.display_name ?? 'there')}
      tasks={tasks}
      pendingCount={inboxPending?.length ?? 0}
      streak={userRow?.study_streak ?? 0}
      hasApiKey={!!apiKey}
      missingSyllabus={missingSyllabus}
    />
  )
}
