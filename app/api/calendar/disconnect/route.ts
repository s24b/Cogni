import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cleanupCogniCalendar } from '@/lib/calendar'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete the Cogni Study calendar from Google before removing credentials.
  // Best-effort — a failure here must not block the disconnect.
  await cleanupCogniCalendar(user.id).catch(e =>
    console.error('[calendar] cleanup on disconnect failed:', e)
  )

  const service = createServiceClient()
  await service
    .from('calendar_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google')

  return NextResponse.json({ ok: true })
}
