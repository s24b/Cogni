import { createServiceClient, createClient } from '@/lib/supabase/server'

export type CourseFile = {
  file_id: string
  course_id: string
  name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  created_at: string
}

const BUCKET = 'course-files'

export async function listCourseFiles(courseId: string): Promise<CourseFile[]> {
  const service = createServiceClient()
  const { data } = await service
    .from('course_files')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  return (data ?? []) as CourseFile[]
}

export async function uploadCourseFile(
  userId: string,
  courseId: string,
  file: { name: string; mimeType: string; bytes: Buffer }
): Promise<CourseFile> {
  const service = createServiceClient()
  const storagePath = `${userId}/${courseId}/${Date.now()}_${file.name}`

  const { error: uploadErr } = await service.storage
    .from(BUCKET)
    .upload(storagePath, file.bytes, { contentType: file.mimeType, upsert: false })

  if (uploadErr) throw uploadErr

  const { data, error } = await service
    .from('course_files')
    .insert({
      user_id: userId,
      course_id: courseId,
      name: file.name,
      mime_type: file.mimeType,
      size_bytes: file.bytes.byteLength,
      storage_path: storagePath,
    })
    .select()
    .single()

  if (error) throw error
  return data as CourseFile
}

export async function deleteCourseFile(userId: string, fileId: string): Promise<void> {
  const service = createServiceClient()

  const { data } = await service
    .from('course_files')
    .select('storage_path')
    .eq('file_id', fileId)
    .eq('user_id', userId)
    .single()

  if (!data) return

  await service.storage.from(BUCKET).remove([data.storage_path])
  await service.from('course_files').delete().eq('file_id', fileId).eq('user_id', userId)
}

/** Get a signed URL valid for 60 minutes (for in-browser PDF viewing) */
export async function getFileUrl(storagePath: string): Promise<string> {
  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Download file bytes (for injecting text content into prompts) */
export async function downloadFileBytes(storagePath: string): Promise<Buffer> {
  const service = createServiceClient()
  const { data, error } = await service.storage.from(BUCKET).download(storagePath)
  if (error) throw error
  return Buffer.from(await data.arrayBuffer())
}

/** Get the current user's file listing (for use in server components) */
export async function getMyFiles(courseId: string): Promise<CourseFile[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  return listCourseFiles(courseId)
}
