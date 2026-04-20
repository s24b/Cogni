import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserApiKey } from '@/lib/vault'
import { readWikiFile, writeWikiFile, appendToLog } from '@/lib/wiki'
import { retrieveChunks } from '@/lib/rag'

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

Return ONLY valid JSON — no other text, no markdown, no code fences.
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

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  // Strip markdown code fences if present, then extract the first {...} block.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  const match = cleaned.match(/\{[\s\S]*\}/)
  const candidate = match ? match[0] : cleaned

  try {
    const parsed = JSON.parse(candidate)
    if (Array.isArray(parsed.topics)) return parsed.topics
    console.error('[profiler] parsed JSON but topics is not an array', parsed)
    return []
  } catch (e) {
    console.error('[profiler] JSON parse failed. Raw response was:\n---\n' + raw.slice(0, 500) + '\n---', e)
    return []
  }
}

async function extractProfessorProfile(
  client: Anthropic,
  professorName: string,
  courseName: string,
  syllabusText: string,
  existingWiki: string | null,
): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are building a professor profile wiki file for a student's AI study system.

Professor: ${professorName}
Course: ${courseName}
${existingWiki ? `\nExisting profile (update and expand, do not lose data):\n${existingWiki}\n` : ''}
Syllabus:
${syllabusText.slice(0, 10000)}

Extract everything that reveals this professor's patterns, priorities, and style. Write a concise markdown wiki file covering:

1. **Grading breakdown** — exact weights if listed (exams, homework, participation, etc.)
2. **Exam style** — number of exams, format (MC, short answer, essay, problems), any stated policies
3. **Topic emphasis** — which topics get the most coverage or grade weight
4. **Stated policies** — late work, attendance, collaboration, make-up exams
5. **Teaching style signals** — anything revealing about how this professor approaches the subject

Be specific and factual — only write what the syllabus actually says. Do not invent patterns. Use markdown headers. Keep it under 400 words.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
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
  courseName: string,
): Promise<void> {
  const tag = `[profiler ${courseName}]`
  const service = createServiceClient()

  const apiKey = await getUserApiKey(userId)
  if (!apiKey) {
    console.error(`${tag} no API key in vault for user ${userId}`)
    return
  }

  const { data: material, error: materialError } = await service
    .from('materials')
    .select('storage_path, filename, file_type')
    .eq('material_id', materialId)
    .single()

  if (materialError || !material?.storage_path) {
    console.error(`${tag} material lookup failed`, materialError)
    return
  }

  const { data: fileData, error: dlError } = await service.storage
    .from('materials')
    .download(material.storage_path)

  if (dlError || !fileData) {
    console.error(`${tag} storage download failed for ${material.storage_path}`, dlError)
    return
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  let syllabusText = ''

  if (material.file_type === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      syllabusText = parsed.text
    } catch (e) {
      console.error(`${tag} pdf-parse failed, falling back to utf-8`, e)
      syllabusText = buffer.toString('utf-8')
    }
  } else {
    syllabusText = buffer.toString('utf-8')
  }

  console.log(`${tag} extracted ${syllabusText.length} chars from ${material.filename}`)

  if (syllabusText.trim().length < 50) {
    console.error(`${tag} syllabus text too short (${syllabusText.length} chars) — skipping`)
    return
  }

  const client = new Anthropic({ apiKey })
  let extractedTopics: ExtractedTopic[] = []
  try {
    extractedTopics = await extractTopics(client, courseName, syllabusText)
  } catch (e) {
    console.error(`${tag} Claude call failed`, e)
    return
  }

  console.log(`${tag} Claude returned ${extractedTopics.length} topics`)

  if (extractedTopics.length === 0) return

  // Deduplicate against existing topics
  const { data: existingTopics } = await service
    .from('topics')
    .select('name')
    .eq('course_id', courseId)

  const existingNames = new Set((existingTopics ?? []).map((t: { name: string }) => t.name.toLowerCase()))
  const newTopics = extractedTopics.filter(t => !existingNames.has(t.name.toLowerCase()))

  if (newTopics.length === 0) return

  const { data: insertedTopics, error: topicInsertError } = await service
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

  if (topicInsertError) {
    console.error(`${tag} topic insert failed`, topicInsertError)
    return
  }

  console.log(`${tag} inserted ${insertedTopics?.length ?? 0} topics`)

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

  // Fetch professor info for this course
  const { data: courseRow } = await service
    .from('courses')
    .select('professor_id, professors ( name )')
    .eq('course_id', courseId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const professorId = courseRow?.professor_id as string | null
  const professorName = professorId
    ? (Array.isArray(courseRow?.professors)
        ? (courseRow.professors[0] as { name: string } | undefined)?.name
        : (courseRow?.professors as { name: string } | null)?.name) ?? null
    : null

  // Build professor wiki from syllabus + any other course material via RAG
  let professorWikiWrite: Promise<void> | null = null
  if (professorId && professorName) {
    const wikiFilename = `professor_${professorId}.md`
    const existing = await readWikiFile(userId, wikiFilename)

    // Retrieve additional course material chunks (lecture notes, textbooks, etc.)
    const ragChunks = await retrieveChunks(
      `${professorName} exam style grading topics emphasis`,
      courseId,
      userId,
      4
    ).catch(() => [])

    const additionalContext = ragChunks.length > 0
      ? `\nAdditional course material excerpts:\n${ragChunks.map(c => c.content).join('\n\n---\n\n')}`
      : ''

    const enrichedSyllabus = syllabusText + additionalContext

    const professorProfile = await extractProfessorProfile(
      client,
      professorName,
      courseName,
      enrichedSyllabus,
      existing,
    )
    if (professorProfile) {
      professorWikiWrite = writeWikiFile(userId, wikiFilename, professorProfile, 'profiler')
    }
  }

  // Update general wiki
  const [profile, weakAreas] = await Promise.all([
    buildLearningProfile(userId),
    buildWeakAreas(userId),
  ])

  await Promise.all([
    writeWikiFile(userId, 'learning_profile.md', profile, 'profiler'),
    writeWikiFile(userId, 'weak_areas.md', weakAreas, 'profiler'),
    appendToLog(userId, `Profiler extracted ${newTopics.length} topics from "${material.filename}" for ${courseName}${professorName ? ` · updated ${professorName}'s profile` : ''}`),
    ...(professorWikiWrite ? [professorWikiWrite] : []),
  ])
}
