import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function getUserKey(userId: string, keyName: string): Promise<string | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('user_keys')
    .select('key_value')
    .eq('user_id', userId)
    .eq('key_name', keyName)
    .single()
  return data?.key_value ?? null
}

export async function setUserKey(userId: string, keyName: string, value: string): Promise<void> {
  const service = createServiceClient()
  await service.from('user_keys').upsert(
    { user_id: userId, key_name: keyName, key_value: value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key_name' }
  )
}

export async function deleteUserKey(userId: string, keyName: string): Promise<void> {
  const service = createServiceClient()
  await service.from('user_keys').delete().eq('user_id', userId).eq('key_name', keyName)
}

/** Convenience: get the authed user's key (for use in server components / route handlers) */
export async function getMyKey(keyName: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getUserKey(user.id, keyName)
}
