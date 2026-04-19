import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen,
  ArrowRight,
  CheckCircle,
  Clock,
  Tray,
} from '@phosphor-icons/react/dist/ssr'

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

  const { data: userRow } = await service
    .from('users')
    .select('display_name')
    .eq('user_id', user.id)
    .single()

  const { data: courses } = await service
    .from('courses')
    .select(`
      course_id,
      name,
      professors ( name ),
      topics ( topic_id ),
      materials ( material_id, processing_status, tier )
    `)
    .eq('user_id', user.id)
    .eq('active_status', 'active')
    .order('created_at', { ascending: true })

  const { data: inboxPending } = await service
    .from('inbox_items')
    .select('inbox_item_id')
    .eq('user_id', user.id)
    .in('classification_status', ['pending', 'unassigned'])

  const name = userRow?.display_name ?? 'there'
  const pendingCount = inboxPending?.length ?? 0

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{greeting(name)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s where things stand with your courses.
        </p>
      </div>

      {/* Inbox nudge */}
      {pendingCount > 0 && (
        <Link
          href="/inbox"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <Tray size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            {pendingCount} item{pendingCount > 1 ? 's' : ''} in your inbox need{pendingCount === 1 ? 's' : ''} review
          </span>
          <ArrowRight size={16} className="text-amber-600 dark:text-amber-400" />
        </Link>
      )}

      {/* Courses */}
      {!courses || courses.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <BookOpen size={36} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No courses yet. Complete onboarding to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Courses</h2>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(courses as any[]).map((course) => {
            const profName = Array.isArray(course.professors)
              ? (course.professors[0] as { name: string } | undefined)?.name
              : (course.professors as { name: string } | null)?.name
            const topicCount = Array.isArray(course.topics) ? course.topics.length : 0
            const materials = Array.isArray(course.materials) ? course.materials : []
            const hasSyllabus = materials.some((m: { tier: number | null; processing_status: string }) =>
              m.tier === 1 && m.processing_status === 'processed'
            )
            const hasProcessing = materials.some((m: { processing_status: string }) =>
              m.processing_status === 'processing'
            )

            return (
              <div
                key={course.course_id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen size={18} className="text-primary" weight="fill" />
                </div>

                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="truncate text-sm font-semibold text-foreground">{course.name}</span>
                  {profName && (
                    <span className="text-xs text-muted-foreground">{profName}</span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  {hasProcessing ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Clock size={12} />
                      Profiling…
                    </span>
                  ) : hasSyllabus && topicCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={12} weight="fill" />
                      {topicCount} topics
                    </span>
                  ) : (
                    <Link
                      href="/inbox"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Upload syllabus
                      <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Coming soon */}
      <div className="mt-auto rounded-xl border border-dashed border-border bg-muted/20 px-5 py-6 text-center">
        <p className="text-sm font-medium text-foreground">Study plan coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Once your syllabuses are profiled, Cogni will generate your daily study plan here.
        </p>
      </div>
    </div>
  )
}
