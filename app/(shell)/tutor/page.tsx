import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TutorClient } from './_client'

export const dynamic = 'force-dynamic'

export default async function TutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()

  const [{ data: courses }, { data: sessions }] = await Promise.all([
    service
      .from('courses')
      .select('course_id, name, professors(name)')
      .eq('user_id', user.id)
      .eq('active_status', 'active')
      .order('created_at', { ascending: true }),
    service
      .from('session_log')
      .select('session_id, course_id, name, mode, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return <TutorClient courses={courses ?? []} sessions={sessions ?? []} />
}
