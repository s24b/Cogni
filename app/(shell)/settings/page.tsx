import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { DevResetButton } from './_dev-reset'
import { CalendarSection } from './_calendar-section'
import { CalendarToast } from './_calendar-toast'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const isDev = process.env.NODE_ENV === 'development'

  const service = createServiceClient()
  const { data: calRow } = await service
    .from('calendar_connections')
    .select('cogni_calendar_id')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()

  const connected = !!calRow
  const calendarName = calRow ? 'Cogni Study' : null

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API keys, calendar, preferences, and account.
        </p>
      </div>

      <Suspense fallback={null}><CalendarToast /></Suspense>
      <CalendarSection connected={connected} calendarName={calendarName} />

      {isDev && (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Developer tools</p>
          <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-500/80">
            Only visible in development. Never shown in production.
          </p>
          <div className="mt-4">
            <DevResetButton />
          </div>
        </div>
      )}
    </div>
  )
}
