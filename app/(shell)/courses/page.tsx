import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesClient } from './_client'

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: courses } = await service
    .from('courses')
    .select(`
      course_id,
      name,
      professors ( name ),
      topics (
        topic_id,
        name,
        syllabus_order,
        topic_mastery ( mastery_score ),
        flashcards ( card_id, fsrs_next_review_date )
      )
    `)
    .eq('user_id', user.id)
    .eq('active_status', 'active')
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shaped = (courses ?? []).map((c: any) => {
    const profName = Array.isArray(c.professors)
      ? c.professors[0]?.name ?? null
      : c.professors?.name ?? null

    const topics = (Array.isArray(c.topics) ? c.topics : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a.syllabus_order ?? 999) - (b.syllabus_order ?? 999))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => {
        const cards: { card_id: string; fsrs_next_review_date: string }[] =
          Array.isArray(t.flashcards) ? t.flashcards : []
        const masteryRows = Array.isArray(t.topic_mastery) ? t.topic_mastery : []
        return {
          topic_id: t.topic_id,
          name: t.name,
          syllabus_order: t.syllabus_order,
          card_count: cards.length,
          due_count: cards.filter((card: { fsrs_next_review_date: string }) => card.fsrs_next_review_date <= today).length,
          mastery_score: masteryRows[0]?.mastery_score ?? null,
        }
      })

    return { course_id: c.course_id, name: c.name, professor_name: profName, topics }
  })

  return <CoursesClient courses={shaped} />
}
