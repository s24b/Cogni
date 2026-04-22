import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MaterialsClient } from './_client'

export default async function MaterialsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()

  const [courseResult, materialsResult] = await Promise.all([
    service
      .from('courses')
      .select('course_id, name, professors ( name )')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .single(),
    service
      .from('materials')
      .select('material_id, tier, file_type, filename, processing_status, uploaded_at')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false }),
  ])

  if (!courseResult.data) redirect('/courses')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = courseResult.data as any
  const profName = Array.isArray(c.professors)
    ? c.professors[0]?.name ?? null
    : c.professors?.name ?? null

  return (
    <MaterialsClient
      courseName={c.name}
      professorName={profName}
      materials={materialsResult.data ?? []}
    />
  )
}
