import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgressClient } from './_client'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()

  const { data: results } = await service
    .from('practice_test_results')
    .select(`
      result_id,
      test_type,
      score_pct,
      question_count,
      correct_count,
      topic_filter,
      created_at,
      courses ( name )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <ProgressClient results={results ?? []} />
}
