import { createServiceClient } from '@/lib/supabase/server'

export async function getUserApiKey(userId: string): Promise<string | null> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('get_user_api_key', { p_user_id: userId })
  if (error || !data) return null
  return data as string
}
