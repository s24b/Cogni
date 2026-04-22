import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { daily_message_limit } = await request.json() as { daily_message_limit: number | null }

  if (daily_message_limit !== null && (!Number.isInteger(daily_message_limit) || daily_message_limit < 1)) {
    return NextResponse.json({ error: 'Limit must be a positive integer' }, { status: 400 })
  }

  const service = createServiceClient()
  await service.from('users').update({ daily_message_limit }).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
