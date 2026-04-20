import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listUserSessions } from '@/lib/agents/tutor'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await listUserSessions(user.id)
  return NextResponse.json({ sessions })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  // Verify ownership before deleting
  const { data: session } = await service
    .from('session_log')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // session_messages cascade via FK
  await service.from('session_log').delete().eq('session_id', sessionId)

  return NextResponse.json({ ok: true })
}
