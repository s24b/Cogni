'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash, CircleNotch, Warning } from '@phosphor-icons/react'

const ONBOARDING_KEY = 'cogni_onboarding_v1'

export function DevResetButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirming' | 'resetting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setState('resetting')
    setError(null)

    try {
      const res = await fetch('/api/dev/reset', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Reset failed')

      // Clear all onboarding localStorage keys
      localStorage.removeItem(ONBOARDING_KEY)

      setState('done')
      setTimeout(() => router.push('/'), 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setState('idle')
    }
  }

  if (state === 'resetting') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <CircleNotch size={16} className="animate-spin" />
        Resetting… deleting DB rows and storage files
      </div>
    )
  }

  if (state === 'done') {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Done — redirecting to onboarding…</p>
    )
  }

  if (state === 'confirming') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
          <Warning size={16} className="mt-0.5 shrink-0" weight="fill" />
          <span>
            This will delete your users row, all courses, topics, flashcards, materials, and storage files.
            Your Google sign-in stays intact.
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Yes, reset everything
          </button>
          <button
            onClick={() => setState('idle')}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setState('confirming')}
        className="flex w-fit items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <Trash size={15} weight="bold" />
        Reset account for testing
      </button>
      <p className="text-xs text-red-500/70">
        Clears DB, storage, and localStorage — leaves your Google account intact
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
