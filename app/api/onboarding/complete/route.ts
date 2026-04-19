import { createClient, createServiceClient } from '@/lib/supabase/server'
import { initWiki } from '@/lib/wiki'
import { NextResponse } from 'next/server'

type CourseInput = {
  tempIndex: number
  name: string
  professorName: string
  existingProfessorId: string | null
}

type SyllabusInput = {
  courseTemp: number
  storagePath: string
  fileName: string
}

export async function POST(request: Request) {
  const { displayName, sessionLength, courses, syllabuses } = await request.json() as {
    displayName: string
    sessionLength: number
    courses: CourseInput[]
    syllabuses: SyllabusInput[]
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  const { error: userError } = await service.from('users').insert({
    user_id: user.id,
    display_name: displayName.trim() || 'Student',
    session_length_preference: sessionLength,
  })

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  const courseIdMap: Record<number, string> = {}

  for (const course of courses) {
    let professorId = course.existingProfessorId

    if (!professorId) {
      const { data: prof, error: profError } = await service
        .from('professors')
        .insert({ user_id: user.id, name: course.professorName.trim() })
        .select('professor_id')
        .single()

      if (profError) {
        return NextResponse.json({ error: profError.message }, { status: 500 })
      }
      professorId = prof.professor_id
    }

    const { data: courseRow, error: courseError } = await service
      .from('courses')
      .insert({ user_id: user.id, professor_id: professorId, name: course.name.trim() })
      .select('course_id')
      .single()

    if (courseError) {
      return NextResponse.json({ error: courseError.message }, { status: 500 })
    }

    courseIdMap[course.tempIndex] = courseRow.course_id
  }

  for (const syl of syllabuses) {
    const courseId = courseIdMap[syl.courseTemp]
    if (!courseId) continue

    await service.from('materials').insert({
      user_id: user.id,
      course_id: courseId,
      filename: syl.fileName,
      storage_path: syl.storagePath,
      tier: 1,
      file_type: 'pdf',
      processing_status: 'pending',
    })
  }

  await initWiki(user.id)

  return NextResponse.json({ ok: true })
}
