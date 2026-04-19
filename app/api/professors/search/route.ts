import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim() ?? ''

  if (name.length < 2) {
    return NextResponse.json({ professors: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ professors: [] })

  const { data } = await supabase
    .from('professors')
    .select('professor_id, name')
    .eq('user_id', user.id)
    .ilike('name', `%${name}%`)
    .limit(5)

  return NextResponse.json({ professors: data ?? [] })
}
