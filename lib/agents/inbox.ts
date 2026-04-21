import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserApiKey } from '@/lib/vault'
import { appendToLog } from '@/lib/wiki'
import { runProfiler } from '@/lib/agents/profiler'
import { processEmbeddings } from '@/lib/rag'

type ClassifyResult = {
  courseId: string | null
  tier: number
  status: 'classified' | 'unassigned' | 'failed'
  isHomework: boolean
  dueDate: string | null
}

async function extractText(buffer: Buffer, fileType: string, filename: string): Promise<string> {
  if (fileType === 'txt' || filename.endsWith('.txt') || filename.endsWith('.md')) {
    return buffer.toString('utf-8')
  }
  if (fileType === 'pdf' || filename.endsWith('.pdf')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      return `[PDF: ${filename}]`
    }
  }
  return `[File: ${filename}]`
}

export async function classifyMaterial(
  userId: string,
  materialId: string,
  storagePath: string,
  filename: string,
  fileType: string,
  context?: string,
  forceCourseId?: string,
): Promise<ClassifyResult> {
  const service = createServiceClient()

  await service.from('materials').update({ processing_status: 'processing' }).eq('material_id', materialId)

  const apiKey = await getUserApiKey(userId)
  if (!apiKey) {
    await service.from('materials').update({ processing_status: 'failed' }).eq('material_id', materialId)
    await service.from('inbox_items').update({ classification_status: 'failed' }).eq('material_id', materialId)
    return { courseId: null, tier: 4, status: 'failed', isHomework: false, dueDate: null }
  }

  const { data: courses } = await service
    .from('courses')
    .select('course_id, name')
    .eq('user_id', userId)
    .eq('active_status', 'active')

  const { data: fileData, error: downloadError } = await service.storage
    .from('materials')
    .download(storagePath)

  if (downloadError || !fileData) {
    await service.from('materials').update({ processing_status: 'failed' }).eq('material_id', materialId)
    await service.from('inbox_items').update({ classification_status: 'failed' }).eq('material_id', materialId)
    return { courseId: null, tier: 4, status: 'failed', isHomework: false, dueDate: null }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const fullContent = await extractText(buffer, fileType, filename)
  const content = fullContent.slice(0, 12000)

  const courseList = (courses ?? []).map((c: { course_id: string; name: string }) => `- ${c.name} (id: ${c.course_id})`).join('\n')

  // If course is pre-assigned (uploaded directly to a course), skip classification
  if (forceCourseId) {
    await service.from('materials').update({ processing_status: 'processed', course_id: forceCourseId, tier: null }).eq('material_id', materialId)
    await service.from('inbox_items').update({ classification_status: 'classified', course_id: forceCourseId, tier: null }).eq('material_id', materialId)
    await appendToLog(userId, `Inbox: "${filename}" assigned directly to course ${forceCourseId}`)
    if (fullContent.length > 100) {
      await processEmbeddings(userId, materialId, fullContent).catch(e => console.error('[rag] processEmbeddings failed', e))
    }
    return { courseId: forceCourseId, tier: 4, status: 'classified', isHomework: false, dueDate: null }
  }

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are classifying a student document. Return ONLY valid JSON, no other text.

Student's courses:
${courseList || '(no courses)'}

Document filename: ${filename}
${context ? `User context: ${context}\n` : ''}Document content (first 12000 chars):
${content}

Classify this document:
1. is_context_hint: true if this is a meta-note or instruction (e.g. "these are my syllabi", "use this to help classify", references other files) rather than actual course material — false otherwise
2. course_id: which course_id from the list above, or null if none match (ignored if is_context_hint is true)
3. tier: 1=syllabus/course overview, 2=primary material (lecture notes, textbook), 3=supplementary (practice problems, past exams), 4=misc/unclear (ignored if is_context_hint is true)
4. is_homework: true if this is a homework assignment, problem set, or assignment sheet that a student needs to submit (NOT lecture notes, past exams, or syllabuses) — false otherwise
5. due_date: if is_homework is true, extract the due date as "YYYY-MM-DD" string (e.g. "2025-11-15"), or null if no due date is mentioned

Respond with exactly: {"is_context_hint":<true|false>,"course_id":"<uuid or null>","tier":<1-4>,"is_homework":<true|false>,"due_date":"<YYYY-MM-DD or null>"}`,
      },
    ],
  })

  let courseId: string | null = null
  let tier = 4
  let isContextHint = false
  let isHomework = false
  let dueDate: string | null = null

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  const candidate = match ? match[0] : cleaned

  try {
    const parsed = JSON.parse(candidate)
    isContextHint = parsed.is_context_hint === true
    courseId = parsed.course_id ?? null
    tier = typeof parsed.tier === 'number' ? Math.max(1, Math.min(4, parsed.tier)) : 4
    isHomework = parsed.is_homework === true
    dueDate = typeof parsed.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date)
      ? parsed.due_date
      : null
  } catch (e) {
    console.error('[inbox] JSON parse failed. Raw response was:\n---\n' + raw.slice(0, 500) + '\n---', e)
  }

  // Auto-dismiss context hints — they're not course materials
  if (isContextHint) {
    await service.from('inbox_items').delete().eq('material_id', materialId)
    await service.from('materials').delete().eq('material_id', materialId)
    await appendToLog(userId, `Inbox: "${filename}" auto-dismissed as context hint`)
    return { courseId: null, tier: 4, status: 'classified', isHomework: false, dueDate: null }
  }

  const classificationStatus = courseId ? 'classified' : 'unassigned'

  await service
    .from('materials')
    .update({ processing_status: 'processed', course_id: courseId ?? undefined, tier })
    .eq('material_id', materialId)

  await service
    .from('inbox_items')
    .update({ classification_status: classificationStatus, course_id: courseId, tier })
    .eq('material_id', materialId)

  const courseName = (courses ?? []).find((c: { course_id: string; name: string }) => c.course_id === courseId)?.name ?? 'unknown course'
  const tierLabel = ['', 'Syllabus', 'Primary', 'Supplementary', 'Misc'][tier]
  await appendToLog(
    userId,
    `Inbox agent classified "${filename}" → ${classificationStatus === 'classified' ? `${courseName} (Tier ${tier}: ${tierLabel})` : 'unassigned'}`
  )

  // Process embeddings for RAG (fire regardless of tier — all material is searchable)
  if (fullContent.length > 100 && classificationStatus === 'classified') {
    await processEmbeddings(userId, materialId, fullContent).catch(e => console.error('[rag] processEmbeddings failed', e))
  }

  // Auto-run profiler for syllabuses (tier 1) that were successfully classified
  if (tier === 1 && courseId) {
    const courseName2 = (courses ?? []).find((c: { course_id: string; name: string }) => c.course_id === courseId)?.name ?? 'Course'
    await runProfiler(userId, materialId, courseId, courseName2)
  }

  return { courseId, tier, status: classificationStatus, isHomework, dueDate }
}
