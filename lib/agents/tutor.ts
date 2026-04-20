import { createServiceClient } from '@/lib/supabase/server'
import { readWikiFile } from '@/lib/wiki'

export type TutorMode = 'answer' | 'teach' | 'focus'

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  answer: 'Answer questions directly and concisely. Explain clearly but don\'t over-elaborate unless the student asks.',
  teach: `Use the Socratic method. Guide the student with questions before providing answers. Do not give the answer directly until the student has genuinely tried.

**Adaptive explanations (Teach mode):** When a student asks you to explain a concept or "what is X", before explaining, ask ONE short calibration question to understand where they are — e.g. "What's your current understanding of X?" or "Where specifically are you stuck?" Use this to tailor the depth and framing of your explanation.

However, skip the calibration question and explain directly at the right level if you already have evidence of what they know:
- The wiki (learning_profile.md / weak_areas.md) records their familiarity with this concept
- Their mastery score for this topic is already recorded (≥60% means they have a working foundation)
- Uploaded course files or the current conversation make their level obvious
- The question itself signals their level clearly (e.g. asking about the chain rule's proof implies they already know what a derivative is)

Never ask calibration questions that the context has already answered. One well-placed question beats a questionnaire.`,

  focus: `Proactively steer the conversation toward the student's weakest topics. After answering, follow up with a related question about a weak area.

**Adaptive explanations (Focus mode):** Same as Teach — when a student asks you to explain a concept, ask ONE calibration question first to tailor your response, unless the wiki, mastery scores, uploaded files, or the conversation itself already tell you what they know. Use that context to calibrate depth and framing, not to ask what you already know. Skip calibration and explain at the appropriate level when the evidence is clear.`,
}

export type AssistanceLevel = 'feedback' | 'suggest' | 'assist'

const COURSE_TYPE_ESSAY_FOCUS: Record<string, string> = {
  humanities: 'Focus on argumentation, thesis strength, evidence use, and citation style.',
  social_science: 'Focus on research framing, methodology clarity, and data interpretation.',
  quantitative: 'Focus on technical precision, logical structure, and clarity of proof or derivation.',
  professional: 'Focus on technical precision, logical structure, and clarity of proof or derivation.',
  conceptual_science: 'Focus on general academic writing: structure, clarity, and argument coherence.',
  language: 'Focus on general academic writing: structure, clarity, and argument coherence.',
}

function buildEssaySection(level: AssistanceLevel, courseType?: string): string {
  const focus = courseType ? (COURSE_TYPE_ESSAY_FOCUS[courseType] ?? COURSE_TYPE_ESSAY_FOCUS.conceptual_science) : 'Focus on general academic writing: structure, clarity, and argument coherence.'

  const levelRules =
    level === 'feedback'
      ? `**Feedback Only** — NEVER call suggest_edit. Your job is to ask questions and give verbal feedback only. Be Socratic: ask "What are you arguing here?" or "How does this support your thesis?" before explaining anything. Guide the student to their own improvements.`
      : level === 'suggest'
      ? `**Suggest** — Give direct feedback in chat AND call suggest_edit to show the student a concrete improvement. You MUST call suggest_edit at least once per response when the student has written content — do not just give verbal feedback and leave. Keep edits small: maximum 2 new sentences per suggest_edit call. Show the change, then explain in chat why you made it.`
      : `**Full Assist** — Act first, explain after. When the student makes any request (expand, rewrite, improve, fix), immediately call suggest_edit with the edit, then explain your reasoning in chat. NEVER ask the student questions before acting — do the work, then tell them what you did and why. Maximum 1 paragraph per suggest_edit call. If you disagree with a request, still make your best version of what they asked for, then note your concern after.`

  return `
## Essay mode
The student is writing an essay. The current essay content is injected at the top of each message as [Current essay content].

${focus}

**Assistance level (this controls both your chat style AND editing permissions):**
${levelRules}

**Guardrails:**
- The student must have written at least one paragraph before you call suggest_edit.
- If asked to write on a blank page, decline: "What point are you trying to make here? Let's build it together."
- Never write an entire essay section unprompted.
- Ignore the Answer/Teach/Focus mode in essay mode — the assistance level above governs everything.`
}

export async function buildTutorSystemPrompt(
  userId: string,
  courseId: string,
  courseName: string,
  mode: TutorMode,
  opts?: { essayMode?: boolean; assistanceLevel?: AssistanceLevel; courseType?: string; ragContext?: string }
): Promise<string> {
  const service = createServiceClient()

  const [learningProfile, weakAreas] = await Promise.all([
    readWikiFile(userId, 'learning_profile.md'),
    readWikiFile(userId, 'weak_areas.md'),
  ])

  const { data: mastery } = await service
    .from('topic_mastery')
    .select('mastery_score, topics(name)')
    .eq('user_id', userId)
    .order('mastery_score', { ascending: true })
    .limit(10)

  const weakTopics = (mastery ?? [])
    .map((m: { mastery_score: number | null; topics: { name: string } | null }) => {
      const topic = m.topics
      return topic ? `- ${topic.name} (${Math.round(Number(m.mastery_score ?? 0) * 100)}%)` : null
    })
    .filter(Boolean)
    .join('\n')

  const verificationSection = mode !== 'answer' ? `
## Verification questions
When a student expresses uncertainty about a topic despite appearing to understand it, ask ONE clear professor-style question in your response text to check their actual grasp. When the student answers that question in their next message, call grade_answer with a score 0.0–1.0:
- 0.0–0.3: poor understanding — tell the student plainly and re-explain
- 0.4–0.6: partial understanding — identify exactly what's missing
- 0.7–1.0: strong understanding — acknowledge it and explore why they felt uncertain
Only call grade_answer when you explicitly posed a verification question and the student has answered it.` : `
## Answer mode — no verification questions
Do NOT ask verification or check-your-understanding questions. The student wants direct answers. Just answer clearly and move on.`

  const essaySection = opts?.essayMode ? buildEssaySection(opts.assistanceLevel ?? 'suggest', opts.courseType) : ''

  const ragSection = opts?.ragContext
    ? `\n## Retrieved course material\nThe following excerpts from the student's uploaded materials are relevant to their question. Prefer this over general knowledge when answering.\n\n${opts.ragContext}`
    : ''

  return `You are a tutor helping a student study ${courseName}. You have access to their course materials and mastery data.

## Behaviour
${MODE_INSTRUCTIONS[mode]}

## Tone and honesty
- Respond directly and clearly. No filler phrases like "Great question!" or "Certainly!".
- No emojis. Ever.
- Do not fabricate information. If you are not certain about something, say so explicitly: "I'm not sure about this — verify with your notes or professor."
- Be blunt and constructive. If the student's answer or reasoning is wrong, say so plainly and explain why.
- Be friendly but not performative. Treat the student as a capable adult.
- Use proper markdown formatting in all responses: headings, bullet points, bold, code blocks, tables where appropriate. Never write a wall of plain text.

## Context
${learningProfile ?? ''}
${weakTopics ? `\nCurrent weak areas:\n${weakTopics}` : ''}
${ragSection}
${verificationSection}

## Wiki patterns
Call write_wiki_pattern ONLY when you observe a durable, non-obvious pattern about how this student learns — something genuinely useful for future sessions. Examples: a systematic misconception that keeps recurring, a topic they struggle with despite repeated practice, a learning approach they've expressed. Do NOT write for routine interactions. Quality over quantity.

## Web search
You have access to a web_search tool. Use it ONLY when:
- The question requires up-to-date information not in the course materials
- The student explicitly asks you to look something up
Always prefer course materials first. Only search for information directly relevant to ${courseName}.

## Guardrails
- Only answer questions about ${courseName}. Accept common abbreviations, full names, and synonyms (e.g. "calc" and "Calculus" are the same). For a clearly unrelated course: "I'm focused on ${courseName} right now. Switch courses to discuss that."
- If a question references material not in the uploaded files, say so. Do not invent content.
- When a student asks for help with an essay or paper, immediately call open_essay_mode — do not refuse. You help them write, you do not ghostwrite for them. The distinction is made inside essay mode.
- Current mode: ${mode}
${essaySection}`
}

export async function createSession(
  userId: string,
  courseId: string,
  mode: TutorMode
): Promise<string> {
  const service = createServiceClient()
  const { data: newSession } = await service
    .from('session_log')
    .insert({ user_id: userId, course_id: courseId, mode })
    .select('session_id')
    .single()

  return newSession!.session_id
}

export async function getOrCreateSession(
  userId: string,
  courseId: string,
  mode: TutorMode
): Promise<string> {
  const service = createServiceClient()

  // Check for an existing open session today
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await service
    .from('session_log')
    .select('session_id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .gte('created_at', today + 'T00:00:00')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing.session_id

  return createSession(userId, courseId, mode)
}

export async function listUserSessions(userId: string) {
  const service = createServiceClient()
  const { data } = await service
    .from('session_log')
    .select('session_id, course_id, name, mode, created_at, essay_content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function getSessionMessages(sessionId: string) {
  const service = createServiceClient()
  const { data } = await service
    .from('session_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function saveMessage(sessionId: string, userId: string, role: 'user' | 'assistant', content: string) {
  const service = createServiceClient()
  await service.from('session_messages').insert({ session_id: sessionId, user_id: userId, role, content })
}

export async function autoNameSession(sessionId: string, userId: string, firstExchange: string, apiKey: string) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Generate a 2-4 word title for a study session that started with this exchange:\n\n${firstExchange.slice(0, 300)}\n\nRespond with ONLY the title, no quotes or punctuation.`,
      }],
    })

    const name = msg.content[0].type === 'text' ? msg.content[0].text.trim() : null
    if (name) {
      const service = createServiceClient()
      await service.from('session_log').update({ name }).eq('session_id', sessionId)
    }
  } catch {
    // Non-critical
  }
}
