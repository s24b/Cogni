'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleLogo, CheckCircle, ArrowSquareOut } from '@phosphor-icons/react'

export function CalendarSection({
  connected,
  calendarName,
}: {
  connected: boolean
  calendarName: string | null
}) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState(false)

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/calendar/disconnect', { method: 'POST' })
      router.refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Calendar</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cogni writes your study blocks to a dedicated &quot;Cogni Study&quot; calendar. Your existing events are never modified.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-background border border-border shrink-0">
          <GoogleLogo size={16} weight="fill" className="text-foreground" />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm font-medium text-foreground">Google Calendar</span>
          {connected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={11} weight="fill" />
              {calendarName ? `Writing to "${calendarName}"` : 'Connected'}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not connected</span>
          )}
        </div>
        {connected ? (
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-destructive transition-colors disabled:opacity-40"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <a
            href="/api/calendar/connect"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect <ArrowSquareOut size={11} />
          </a>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Apple Calendar and Outlook support coming soon.
      </p>
    </div>
  )
}
