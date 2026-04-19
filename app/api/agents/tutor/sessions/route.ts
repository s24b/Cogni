import { createClient } from '@/lib/supabase/server'
import { listUserSessions } from '@/lib/agents/tutor'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await listUserSessions(user.id)
  return NextResponse.json({ sessions })
}
