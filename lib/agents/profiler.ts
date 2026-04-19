import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserApiKey } from '@/lib/vault'
import { readWikiFile, writeWikiFile, appendToLog } from '@/lib/wiki'

type ExtractedTopic = {
  name: string
  syllabus_order: number
}

async function extractTopics(
  client: Anthropic,
  courseNames: string,
  syllabusText: string
): Promise<ExtractedTopic[]> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extract the main study topics from this syllabus for the course "${courseNames}".

Return ONLY valid JSON — no other text.
Rules:
- Extract 8–25 main topics (not every sub-bullet, just meaningful study units)
- Use the order they appear in the syllabus
- Keep names concise (3–6 words max)

Syllabus:
${syllabusText.slice(0, 10000)}

Respond with exactly: {"topics":[{"name":"...","syllabus_order":1},{"name":"...","syllabus_order":2},...]}`,
      },
    ],
  })

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const parsed = JSON.parse(text)
    return Array.isArray(parsed.topics) ? parsed.topics : []
  } catch {
    return []
  }
}

async function buildLearningProfile(userId: string): Promise<string> {
  const service = createServiceClient()

  const { data: courses } = await service
    .from('courses')
    .select(`
      course_id,
      name,
      professors ( name ),
      topics ( topic_id )
    `)
    .eq('user_id', userId)
    .eq('active_status', 'active')

  if (!courses || courses.length === 0) {
    return `# Learning Profile\n\n*No courses enrolled yet.*\n`
  }

  const lines = ['# Learning Profile', '', '## Enrolled Courses', '']
  for (const course of courses) {
    const profName = Array.isArray(course.professors)
      ? (course.professors[0] as { name: string } | undefined)?.name ?? 'Unknown'
      : (course.professors as { name: string } | null)?.name ?? 'Unknown'
    const topicCount = Array.isArray(course.topics) ? course.topics.length : 0
    lines.push(`### ${course.name}`)
    lines.push(`- Professor: ${profName}`)
    lines.push(`- Topics extracted: ${topicCount}`)
    lines.push('')
  }

  lines.push('## Strengths', '*Will be updated as you study.*', '')
  lines.push('## Study Preferences', '*Derived from session history over time.*', '')

  return lines.join('\n')
}

async function buildWeakAreas(userId: string): Promise<string> {
  const service = createServiceClient()

  const { data: mastery } = await service
    .from('topic_mastery')
    .select(`
      mastery_score,
      topics ( name, courses ( name ) )
    `)
    .eq('user_id', userId)
    .order('mastery_score', { ascending: true })
    .limit(20)

  const lines = ['# Weak Areas', '', '*Updated by the Profiler Agent after each study session.*', '']

  if (!mastery || mastery.length === 0) {
    lines.push('No mastery data yet. Topics will appear here as you study.')
    return lines.join('\n')
  }

  for (const row of mastery) {
    const topic = row.topics as { name: string; courses: { name: string } | null } | null
    if (!topic) continue
    const score = Math.round((row.mastery_score ?? 0) * 100)
    const course = topic.courses?.name ?? 'Unknown course'
    lines.push(`- **${topic.name}** (${course}) — ${score}% mastery`)
  }

  return lines.join('\n')
}

export async function runProfiler(
  userId: string,
  materialId: string,
  courseId: string,
  courseName: string
): Promise<void> {
  const service = createServiceClient()

  const apiKey = await getUserApiKey(userId)
  if (!apiKey) return

  const { data: material } = await service
    .from('materials')
    .select('storage_path, filename, file_type')
    .eq('material_id', materialId)
    .single()

  if (!material?.storage_path) return

  const { data: fileData } = await service.storage
    .from('materials')
    .download(material.storage_path)

  if (!fileData) return

  const buffer = Buffer.from(await fileData.arrayBuffer())
  let syllabusText = ''

  if (material.file_type === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      syllabusText = parsed.text
    } catch {
      syllabusText = buffer.toString('utf-8')
    }
  } else {
    syllabusText = buffer.toString('utf-8')
  }

  const client = new Anthropic({ apiKey })
  const extractedTopics = await extractTopics(client, courseName, syllabusText)

  if (extractedTopics.length === 0) return

  // Deduplicate against existing topics
  const { data: existingTopics } = await service
    .from('topics')
    .select('name')
    .eq('course_id', courseId)

  const existingNames = new Set((existingTopics ?? []).map((t: { name: string }) => t.name.toLowerCase()))
  const newTopics = extractedTopics.filter(t => !existingNames.has(t.name.toLowerCase()))

  if (newTopics.length === 0) return

  const { data: insertedTopics } = await service
    .from('topics')
    .insert(
      newTopics.map(t => ({
        course_id: courseId,
        user_id: userId,
        name: t.name,
        syllabus_order: t.syllabus_order,
      }))
    )
    .select('topic_id')

  if (insertedTopics && insertedTopics.length > 0) {
    await service.from('topic_mastery').insert(
      insertedTopics.map((t: { topic_id: string }) => ({
        user_id: userId,
        topic_id: t.topic_id,
        mastery_score: 0,
        confidence: 0,
      }))
    )
  }

  // Update wiki
  const [profile, weakAreas] = await Promise.all([
    buildLearningProfile(userId),
    buildWeakAreas(userId),
  ])

  await Promise.all([
    writeWikiFile(userId, 'learning_profile.md', profile, 'profiler'),
    writeWikiFile(userId, 'weak_areas.md', weakAreas, 'profiler'),
    appendToLog(userId, `Profiler extracted ${newTopics.length} topics from "${material.filename}" for ${courseName}`),
  ])
}
