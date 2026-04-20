import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function clearStorageBucket(service: any, bucket: string, userId: string) {
  const prefixes = [userId, `${userId}/syllabuses`]
  for (const prefix of prefixes) {
    const { data: files } = await service.storage.from(bucket).list(prefix, { limit: 200 })
    if (!files?.length) continue
    const paths = files
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => `${prefix}/${f.name}`)
    if (paths.length) await service.storage.from(bucket).remove(paths)
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  await service.from('users').delete().eq('user_id', user.id)

  await Promise.all([
    clearStorageBucket(service, 'wiki', user.id),
    clearStorageBucket(service, 'materials', user.id),
    clearStorageBucket(service, 'audio', user.id),
  ])

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
