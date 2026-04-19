import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserApiKey } from '@/lib/vault'
import { appendToLog } from '@/lib/wiki'
import { runProfiler } from '@/lib/agents/profiler'

type ClassifyResult = {
  courseId: string | null
  tier: number
  status: 'classified' | 'unassigned' | 'failed'
}

async function extractText(buffer: Buffer, fileType: string, filename: string): Promise<string> {
  if (fileType === 'txt' || filename.endsWith('.txt') || filename.endsWith('.md')) {
    return buffer.toString('utf-8').slice(0, 12000)
  }
  if (fileType === 'pdf' || filename.endsWith('.pdf')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return data.text.slice(0, 12000)
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
  fileType: string
): Promise<ClassifyResult> {
  const service = createServiceClient()

  await service.from('materials').update({ processing_status: 'processing' }).eq('material_id', materialId)

  const apiKey = await getUserApiKey(userId)
  if (!apiKey) {
    await service.from('materials').update({ processing_status: 'failed' }).eq('material_id', materialId)
    await service.from('inbox_items').update({ classification_status: 'failed' }).eq('material_id', materialId)
    return { courseId: null, tier: 4, status: 'failed' }
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
    return { courseId: null, tier: 4, status: 'failed' }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const content = await extractText(buffer, fileType, filename)

  const courseList = (courses ?? []).map((c: { course_id: string; name: string }) => `- ${c.name} (id: ${c.course_id})`).join('\n')

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are classifying a student document. Return ONLY valid JSON, no other text.

Student's courses:
${courseList || '(no courses)'}

Document filename: ${filename}
Document content (first 12000 chars):
${content}

Classify this document:
1. course_id: which course_id from the list above, or null if none match
2. tier: 1=syllabus/course overview, 2=primary material (lecture notes, textbook), 3=supplementary (practice problems, past exams), 4=misc/unclear

Respond with exactly: {"course_id":"<uuid or null>","tier":<1-4>}`,
      },
    ],
  })

  let courseId: string | null = null
  let tier = 4

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const parsed = JSON.parse(text)
    courseId = parsed.course_id ?? null
    tier = typeof parsed.tier === 'number' ? Math.max(1, Math.min(4, parsed.tier)) : 4
  } catch {
    // Default to unassigned if parse fails
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

  // Auto-run profiler for syllabuses (tier 1) that were successfully classified
  if (tier === 1 && courseId) {
    const courseName2 = (courses ?? []).find((c: { course_id: string; name: string }) => c.course_id === courseId)?.name ?? 'Course'
    await runProfiler(userId, materialId, courseId, courseName2)
  }

  return { courseId, tier, status: classificationStatus }
}
