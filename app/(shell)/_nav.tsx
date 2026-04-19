'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  MessageCircle,
  Inbox,
  BookOpen,
  TrendingUp,
  Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/today', label: 'Today', Icon: Home },
  { href: '/tutor', label: 'Tutor', Icon: MessageCircle },
  { href: '/inbox', label: 'Inbox', Icon: Inbox },
  { href: '/courses', label: 'Courses', Icon: BookOpen },
  { href: '/progress', label: 'Progress', Icon: TrendingUp },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Image src="/logo.svg" alt="Cogni" width={26} height={26} priority />
        <span className="font-heading text-base font-bold text-foreground">Cogni</span>
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
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={active ? 2 : 1.5}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            isActive(pathname, '/settings')
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Settings
            className="h-[18px] w-[18px] shrink-0"
            strokeWidth={isActive(pathname, '/settings') ? 2 : 1.5}
          />
          Settings
        </Link>
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
            <Icon
              className="h-5 w-5"
              strokeWidth={active ? 2 : 1.5}
            />
            {label}
          </Link>
        )
      })}

      <Link
        href="/settings"
        className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
          isActive(pathname, '/settings') ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <Settings
          className="h-5 w-5"
          strokeWidth={isActive(pathname, '/settings') ? 2 : 1.5}
        />
        Settings
      </Link>
    </nav>
  )
}
