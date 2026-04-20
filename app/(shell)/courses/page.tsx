import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { readWikiFile } from '@/lib/wiki'
import { CoursesClient } from './_client'

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const service = createServiceClient()

  const [{ data: activeCourses }, { data: archivedCourses }] = await Promise.all([
    service
      .from('courses')
      .select(`
        course_id,
        name,
        professors ( name ),
        topics (
          topic_id,
          content_coverage,
          topic_mastery ( mastery_score ),
          flashcards ( card_id )
        ),
        materials ( material_id )
      `)
      .eq('user_id', user.id)
      .eq('active_status', 'active')
      .order('created_at', { ascending: true }),
    service
      .from('courses')
      .select(`
        course_id,
        name,
        professor_id,
        professors ( name ),
        topics ( topic_id, content_coverage, flashcards ( card_id ) )
      `)
      .eq('user_id', user.id)
      .eq('active_status', 'archived')
      .order('created_at', { ascending: true }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function shapeCourse(c: any) {
    const profName = Array.isArray(c.professors)
      ? c.professors[0]?.name ?? null
      : c.professors?.name ?? null

    const topics = Array.isArray(c.topics) ? c.topics : []
    const cardCount = topics.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, t: any) => sum + (Array.isArray(t.flashcards) ? t.flashcards.length : 0),
      0,
    )
    const avgCoverage =
      topics.length > 0
        ? topics.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, t: any) => sum + Number(t.content_coverage ?? 0),
            0,
          ) / topics.length
        : 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masteryScores = topics.flatMap((t: any) =>
      Array.isArray(t.topic_mastery) ? t.topic_mastery.map((m: any) => Number(m.mastery_score ?? 0)) : []
    )
    const avgMastery = masteryScores.length > 0
      ? masteryScores.reduce((s: number, v: number) => s + v, 0) / masteryScores.length
      : 0

    return {
      course_id: c.course_id,
      name: c.name,
      professor_id: c.professor_id ?? null,
      professor_name: profName,
      topic_count: topics.length,
      card_count: cardCount,
      avg_coverage: avgCoverage,
      avg_mastery: avgMastery,
      material_count: Array.isArray(c.materials) ? c.materials.length : 0,
    }
  }

  const shapedArchived = (archivedCourses ?? []).map(shapeCourse)

  // Read professor wiki for archived courses (server-side only)
  const archivedWithWiki = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shapedArchived.map(async (c: any) => {
      const wiki = c.professor_id
        ? await readWikiFile(user.id, `professor_${c.professor_id}.md`)
        : null
      return { ...c, professor_wiki: wiki }
    })
  )

  return (
    <CoursesClient
      courses={(activeCourses ?? []).map(shapeCourse)}
      archivedCourses={archivedWithWiki}
    />
  )
}
