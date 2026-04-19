import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'wiki'

function storagePath(userId: string, filename: string) {
  return `${userId}/${filename}`
}

export async function readWikiFile(userId: string, filename: string): Promise<string | null> {
  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(BUCKET)
    .download(storagePath(userId, filename))

  if (error || !data) return null
  return data.text()
}

export async function writeWikiFile(
  userId: string,
  filename: string,
  content: string,
  triggeredByAgent?: string
): Promise<void> {
  const service = createServiceClient()

  await service.storage
    .from(BUCKET)
    .upload(storagePath(userId, filename), new Blob([content], { type: 'text/markdown' }), {
      upsert: true,
    })

  await service.from('wiki_versions').insert({
    user_id: userId,
    file_path: filename,
    content,
    triggered_by_agent: triggeredByAgent ?? null,
  })
}

export async function appendToLog(userId: string, entry: string): Promise<void> {
  const existing = await readWikiFile(userId, 'log.md') ?? ''
  const timestamp = new Date().toISOString()
  const newContent = existing + `\n- [${timestamp}] ${entry}`
  await writeWikiFile(userId, 'log.md', newContent.trimStart(), 'system')
}

const INITIAL_FILES: Record<string, string> = {
  'learning_profile.md': `# Learning Profile

*This file is maintained by Cogni agents. It tracks your learning style, strengths, and areas for improvement.*

## Overview
No data yet. Profile will be built as you study.

## Strengths
*To be populated by the Profiler Agent.*

## Areas for Improvement
*To be populated by the Profiler Agent.*

## Study Preferences
*To be populated from onboarding and session history.*
`,
  'weak_areas.md': `# Weak Areas

*Updated by the Profiler Agent after each study session.*

No weak areas identified yet. Keep studying!
`,
  'index.md': `# Wiki Index

| File | Description |
|------|-------------|
| learning_profile.md | Your learning style and strengths |
| weak_areas.md | Topics needing extra review |
| log.md | Activity log |
`,
  'log.md': '',
}

export async function initWiki(userId: string): Promise<void> {
  const service = createServiceClient()

  // Check if already initialized
  const { data } = await service.storage
    .from(BUCKET)
    .list(userId, { limit: 1 })

  if (data && data.length > 0) return

  await Promise.all(
    Object.entries(INITIAL_FILES).map(([filename, content]) =>
      writeWikiFile(userId, filename, content, 'system')
    )
  )

  await appendToLog(userId, 'Wiki initialized after onboarding completion.')
}
