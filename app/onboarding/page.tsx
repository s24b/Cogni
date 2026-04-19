import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './_client'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  const { data: userRecord } = await supabase
    .from('users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (userRecord) redirect('/today')

  const googleName: string =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    ''

  return <OnboardingClient googleName={googleName} />
}
