'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignOut, Trash, Warning } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

export function AccountSection() {
  const router = useRouter()
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming'>('idle')
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [signingOut, setSigningOut] = useState(false)

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
