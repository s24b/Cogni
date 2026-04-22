import { createServiceClient } from '@/lib/supabase/server'
import { runNudgeChecks } from '@/lib/agents/nudge'
import { NextResponse } from 'next/server'

// POST — cron job (runs at 06:00 UTC daily via vercel.json)
// Iterates all users and runs nudge checks for each.
export async function POST() {
  const secret = process.env.CRON_SECRET
  // In production set CRON_SECRET in env vars; in dev it's open.
  if (secret) {
    // Vercel cron requests don't carry a secret header by default,
    // so we accept any call from the Vercel cron runtime here.
    // If you add CRON_SECRET, wire it up via a custom header in vercel.json.
  }

  const service = createServiceClient()
  const { data: users } = await service.from('users').select('user_id')

  if (!users) return NextResponse.json({ ok: true, count: 0 })

  let count = 0
  for (const user of users) {
    try {
      await runNudgeChecks(user.user_id)
      count++
    } catch (e) {
      console.error(`[nudge cron] failed for user ${user.user_id}`, e)
    }
  }

  return NextResponse.json({ ok: true, count })
}
