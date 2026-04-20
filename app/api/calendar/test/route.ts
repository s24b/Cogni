import { createClient } from '@/lib/supabase/server'
import { writeStudyBlocksToCalendar } from '@/lib/calendar'
import { NextResponse } from 'next/server'

// Dev-only test endpoint — remove before shipping
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await writeStudyBlocksToCalendar(user.id, [
      { course_name: 'Test Block', duration_minutes: 30, order: 1 },
    ])
    return NextResponse.json({ ok: true, message: 'Calendar write attempted — check your Google Calendar' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
