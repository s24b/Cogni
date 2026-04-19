import { createClient } from '@/lib/supabase/server'
import { runScheduler } from '@/lib/agents/scheduler'
import { NextResponse } from 'next/server'

// Intraday rerun — called when mastery drops, study guide uploaded, or dates change
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await runScheduler(user.id)
  return NextResponse.json({ ok: true })
}
