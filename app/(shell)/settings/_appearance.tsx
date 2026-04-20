'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Desktop } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Desktop },
] as const

export function AppearancePicker() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 transition-colors ${
            theme === value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
          }`}
        >
          <Icon size={18} weight={theme === value ? 'fill' : 'regular'} />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}
