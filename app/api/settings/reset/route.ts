import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function clearBucket(service: ReturnType<typeof createServiceClient>, bucket: string, userId: string) {
  const prefixes = [userId, `${userId}/syllabuses`]
  for (const prefix of prefixes) {
    const { data: files } = await service.storage.from(bucket).list(prefix, { limit: 200 })
    if (!files?.length) continue
    const paths = files
      .filter((f: { id?: string }) => f.id)
      .map((f: { name: string }) => `${prefix}/${f.name}`)
    if (paths.length) await service.storage.from(bucket).remove(paths)
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Delete user row — cascades all app data (courses, topics, flashcards, materials, etc.)
  await service.from('users').delete().eq('user_id', user.id)

  // Clear all storage buckets
  await Promise.all([
    clearBucket(service, 'wiki', user.id),
    clearBucket(service, 'materials', user.id),
    clearBucket(service, 'audio', user.id),
    clearBucket(service, 'course-files', user.id),
  ])

  return NextResponse.json({ ok: true })
}
