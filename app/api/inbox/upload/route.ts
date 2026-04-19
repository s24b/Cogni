import { createClient, createServiceClient } from '@/lib/supabase/server'
import { classifyMaterial } from '@/lib/agents/inbox'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedExts = ['pdf', 'txt', 'md']
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type. Upload PDF or TXT.' }, { status: 400 })
  }

  const service = createServiceClient()
  const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await service.storage
    .from('materials')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: material, error: materialError } = await service
    .from('materials')
    .insert({
      user_id: user.id,
      filename: file.name,
      storage_path: storagePath,
      file_type: ext,
      tier: null,
      processing_status: 'pending',
    })
    .select('material_id')
    .single()

  if (materialError || !material) {
    return NextResponse.json({ error: materialError?.message ?? 'DB error' }, { status: 500 })
  }

  const { data: inboxItem, error: inboxError } = await service
    .from('inbox_items')
    .insert({
      user_id: user.id,
      material_id: material.material_id,
      classification_status: 'pending',
    })
    .select('inbox_item_id')
    .single()

  if (inboxError || !inboxItem) {
    return NextResponse.json({ error: inboxError?.message ?? 'DB error' }, { status: 500 })
  }

  const result = await classifyMaterial(user.id, material.material_id, storagePath, file.name, ext)

  return NextResponse.json({ ok: true, inbox_item_id: inboxItem.inbox_item_id, ...result })
}
