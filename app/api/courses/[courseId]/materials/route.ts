import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const service = createServiceClient()

  const { data: materials, error } = await service
    .from('materials')
    .select('material_id, filename, tier, file_type, processing_status')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .in('processing_status', ['processed'])
    .order('tier', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ materials: materials ?? [] })
}
