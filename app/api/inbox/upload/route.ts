import { createClient, createServiceClient } from '@/lib/supabase/server'
import { classifyMaterial } from '@/lib/agents/inbox'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const textContent = form.get('textContent') as string | null
  const context = (form.get('context') as string | null) ?? undefined
  const courseIdHint = (form.get('courseId') as string | null) ?? undefined

  if (!file && !textContent) {
    return NextResponse.json({ error: 'No file or text content' }, { status: 400 })
  }

  const service = createServiceClient()

  let filename: string
  let ext: string
  let fileBlob: Blob
  let contentType: string

  if (file) {
    ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowedExts = ['pdf', 'txt', 'md']
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Upload PDF or TXT.' }, { status: 400 })
    }
    filename = file.name
    fileBlob = file
    contentType = file.type || 'application/octet-stream'
  } else {
    // Text entry — store as a .txt material
    const label = (form.get('name') as string | null)?.trim() || 'Note'
    filename = `${label.replace(/[^a-zA-Z0-9 _-]/g, '').trim()}_${Date.now()}.txt`
    ext = 'txt'
    fileBlob = new Blob([textContent!], { type: 'text/plain' })
    contentType = 'text/plain'
  }

  // Reject duplicates by filename (files only, not text entries)
  if (file) {
    const { data: existing } = await service
      .from('materials')
      .select('material_id')
      .eq('user_id', user.id)
      .eq('filename', filename)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `"${filename}" has already been uploaded.` },
        { status: 409 }
      )
    }
  }

  const storagePath = `${user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await service.storage
    .from('materials')
    .upload(storagePath, fileBlob, { contentType, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: material, error: materialError } = await service
    .from('materials')
    .insert({
      user_id: user.id,
      filename,
      storage_path: storagePath,
      file_type: file ? ext : 'typed',
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

  const result = await classifyMaterial(
    user.id,
    material.material_id,
    storagePath,
    filename,
    ext,
    context,
    courseIdHint,
  )

  return NextResponse.json({ ok: true, inbox_item_id: inboxItem.inbox_item_id, ...result })
}
