import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InboxClient } from './_client'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()
  const { data: items } = await service
    .from('inbox_items')
    .select(`
      inbox_item_id,
      classification_status,
      course_id,
      tier,
      created_at,
      materials ( filename, file_type ),
      courses ( name )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <InboxClient items={items ?? []} />
}
