'use client'

import { useState } from 'react'

export function TutorLimitPicker({ initial }: { initial: number | null }) {
  const [value, setValue] = useState(initial != null ? String(initial) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    const parsed = value.trim() === '' ? null : Number(value.trim())
    if (parsed !== null && (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed))) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/tutor-limit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_message_limit: parsed }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false) }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="No limit"
          className="w-32 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-xs text-success">Saved</span>}
      </div>
      <p className="text-xs text-muted-foreground">Leave blank to allow unlimited messages.</p>
    </div>
  )
}
