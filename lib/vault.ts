import { createServiceClient } from '@/lib/supabase/server'

export async function getUserApiKey(userId: string): Promise<string | null> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('get_user_api_key', { p_user_id: userId })
  if (error) {
    console.error('[vault] get_user_api_key RPC error:', error)
    return null
  }
  if (!data) {
    console.error(`[vault] get_user_api_key returned empty for user ${userId} (secret name should be "api_key_${userId}")`)
    return null
  }
  return data as string
}
