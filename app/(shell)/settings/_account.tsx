'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignOut, Trash, Warning, ArrowCounterClockwise } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

export function AccountSection() {
  const router = useRouter()
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming'>('idle')
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [resetState, setResetState] = useState<'idle' | 'confirming'>('idle')
  const [resetText, setResetText] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  async function deleteAccount() {
    if (confirmText !== 'DELETE') return
    setIsDeleting(true)
    await fetch('/api/settings/account', { method: 'DELETE' })
    router.push('/auth')
  }

  async function resetAccount() {
    if (resetText !== 'RESET') return
    setIsResetting(true)
    await fetch('/api/settings/reset', { method: 'POST' })
    router.push('/onboarding')
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={signOut}
        disabled={signingOut}
        className="flex w-fit items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors disabled:opacity-40"
      >
        <SignOut size={15} />
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>

      {resetState === 'idle' && (
        <button
          onClick={() => setResetState('confirming')}
          className="flex w-fit items-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 dark:border-amber-800/50 dark:text-amber-400 dark:hover:bg-amber-950/30 transition-colors"
        >
          <ArrowCounterClockwise size={15} />
          Reset account content
        </button>
      )}

      {resetState === 'confirming' && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-400">
              This will delete all your courses, topics, flashcards, uploaded materials, and wiki files. Your account and API keys are kept. You&apos;ll be taken through onboarding again.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-amber-800 dark:text-amber-400">
              Type <span className="font-mono font-bold">RESET</span> to confirm
            </label>
            <input
              type="text"
              value={resetText}
              onChange={e => setResetText(e.target.value)}
              placeholder="RESET"
              className="w-48 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetAccount}
              disabled={resetText !== 'RESET' || isResetting}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
            >
              {isResetting ? 'Resetting…' : 'Reset my content'}
            </button>
            <button
              onClick={() => { setResetState('idle'); setResetText('') }}
              className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteState === 'idle' && (
        <button
          onClick={() => setDeleteState('confirming')}
          className="flex w-fit items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
        >
          <Trash size={15} />
          Delete account
        </button>
      )}

      {deleteState === 'confirming' && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex items-start gap-2">
            <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-400">
              This will permanently delete all your data — courses, topics, flashcards, materials, and wiki files. This cannot be undone.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-red-700 dark:text-red-400">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-48 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-400 dark:border-red-800 dark:bg-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={deleteAccount}
              disabled={confirmText !== 'DELETE' || isDeleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
            >
              {isDeleting ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              onClick={() => { setDeleteState('idle'); setConfirmText('') }}
              className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
