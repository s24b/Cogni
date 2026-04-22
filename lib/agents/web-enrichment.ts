import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

export async function runWebEnrichment(
  userId: string,
  courseId: string,
  courseName: string,
  professorName: string,
  apiKey: string,
): Promise<void> {
  const tag = `[web-enrichment ${courseName}]`
  const client = new Anthropic({ apiKey })

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Search the web for the public syllabus or course outline for "${courseName}" taught by professor "${professorName}". Look for a real course document that contains the list of topics covered, exam dates, and grading breakdown. Return the full raw text of whatever you find — do not summarize or paraphrase it, return it verbatim. If you cannot find a clear match for this specific course and professor, reply with exactly: NOT_FOUND`,
    },
  ]

  let resultText = ''
  let resultTitle: string | undefined
  let resultUrl: string | undefined
  let iterations = 0

  try {
    while (iterations < 4) {
      iterations++

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamParams: any = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      }

      const stream = client.messages.stream(streamParams)

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (event.delta as any).type === 'text_delta'
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultText += (event.delta as any).text
        }
      }

      const final = await stream.finalMessage()

      // Extract URL/title from web_search result blocks if present
      for (const block of final.content) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = block as any
        if (b.type === 'tool_result' || b.type === 'web_search_result') {
          if (b.url && !resultUrl) resultUrl = b.url
          if (b.title && !resultTitle) resultTitle = b.title
        }
      }

      if (final.stop_reason === 'tool_use') {
        const hasCustomTools = final.content.some(
          b => b.type === 'tool_use' && (b as Anthropic.ToolUseBlock).name !== 'web_search'
        )
        if (!hasCustomTools) {
          // Only server-side tools were called — continue loop so model can respond
          messages.push({ role: 'assistant', content: final.content })
          continue
        }
      }

      break
    }
  } catch (e) {
    console.error(`${tag} Anthropic call failed`, e)
    return
  }

  const trimmed = resultText.trim()

  if (!trimmed || trimmed === 'NOT_FOUND' || trimmed.length < 100) {
    console.log(`${tag} no useful content found`)
    return
  }

  const service = createServiceClient()

  // Only create one pending suggestion per course — skip if one already exists
  const { data: existing } = await service
    .from('course_web_suggestions')
    .select('id')
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (existing) {
    console.log(`${tag} pending suggestion already exists, skipping`)
    return
  }

  await service.from('course_web_suggestions').insert({
    course_id: courseId,
    user_id: userId,
    title: resultTitle ?? null,
    url: resultUrl ?? null,
    content: trimmed,
  })

  console.log(`${tag} stored web suggestion (${trimmed.length} chars)`)
}
