'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  House,
  ChatCircle,
  Tray,
  BookOpen,
  ChartLineUp,
  GearSix,
} from '@phosphor-icons/react'

type NavItem = {
  href: string
  label: string
  Icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', Icon: House },
  { href: '/tutor', label: 'Tutor', Icon: ChatCircle },
  { href: '/inbox', label: 'Inbox', Icon: Tray },
  { href: '/courses', label: 'Courses', Icon: BookOpen },
  { href: '/progress', label: 'Progress', Icon: ChartLineUp },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center px-5 py-5">
        <Image src="/logo.svg" alt="Cogni" width={96} height={33} priority />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Icon
                size={18}
                weight={active ? 'fill' : 'regular'}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        {(() => {
          const active = isActive(pathname, '/settings')
          return (
            <Link
              href="/settings"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <GearSix size={18} weight={active ? 'fill' : 'regular'} />
              Settings
            </Link>
          )
        })()}
      </div>
    </aside>
  )
}

// ─── Mobile bottom bar ────────────────────────────────────────────────────────

export function BottomBar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon size={22} weight={active ? 'fill' : 'regular'} />
            {label}
          </Link>
        )
      })}

      {(() => {
        const active = isActive(pathname, '/settings')
        return (
          <Link
            href="/settings"
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <GearSix size={22} weight={active ? 'fill' : 'regular'} />
            Settings
          </Link>
        )
      })()}
    </nav>
  )
}
