'use client'

import {
  Article, Atom, BookBookmark, BookOpen, BookOpenText,
  Brain, BracketsCurly, Calculator, ChartBar, ChartLine,
  Code, Coins, Compass, Cpu, Dna, Flask,
  GraduationCap, Globe, Heartbeat, Leaf,
  Lightbulb, MathOperations, Microscope, MusicNotes,
  PaintBrush, Palette, Pencil, Ruler, Scales,
  Scroll, Sigma, Star, Terminal, TestTube, Translate, Lightning,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
export type { IconColorId } from './course-icon-names'
export { ICON_NAMES, ICON_COLOR_IDS } from './course-icon-names'

export const COURSE_ICON_MAP: Record<string, Icon> = {
  Article, Atom, BookBookmark, BookOpen, BookOpenText,
  Brain, BracketsCurly, Calculator, ChartBar, ChartLine,
  Code, Coins, Compass, Cpu, Dna, Flask,
  GraduationCap, Globe, Heartbeat, Leaf,
  Lightbulb, MathOperations, Microscope, MusicNotes,
  PaintBrush, Palette, Pencil, Ruler, Scales,
  Scroll, Sigma, Star, Terminal, TestTube, Translate, Lightning,
}

export const ICON_COLORS: Record<import('./course-icon-names').IconColorId, { bg: string; icon: string; swatch: string }> = {
  blue:    { bg: 'bg-blue-500/10',    icon: 'text-blue-600 dark:text-blue-400',    swatch: 'bg-blue-500' },
  violet:  { bg: 'bg-violet-500/10',  icon: 'text-violet-600 dark:text-violet-400',  swatch: 'bg-violet-500' },
  emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', swatch: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-500/10',   icon: 'text-amber-600 dark:text-amber-400',   swatch: 'bg-amber-500' },
  rose:    { bg: 'bg-rose-500/10',    icon: 'text-rose-600 dark:text-rose-400',    swatch: 'bg-rose-500' },
  cyan:    { bg: 'bg-cyan-500/10',    icon: 'text-cyan-600 dark:text-cyan-400',    swatch: 'bg-cyan-500' },
  orange:  { bg: 'bg-orange-500/10',  icon: 'text-orange-600 dark:text-orange-400',  swatch: 'bg-orange-500' },
  indigo:  { bg: 'bg-indigo-500/10',  icon: 'text-indigo-600 dark:text-indigo-400',  swatch: 'bg-indigo-500' },
}

export const DEFAULT_ICON = 'BookOpen'
export const DEFAULT_COLOR: import('./course-icon-names').IconColorId = 'blue'

export function resolveIcon(icon: string | null) {
  const name = icon ?? DEFAULT_ICON
  return COURSE_ICON_MAP[name] ?? COURSE_ICON_MAP[DEFAULT_ICON]
}

export function resolveColor(color: string | null) {
  return ICON_COLORS[(color as import('./course-icon-names').IconColorId) ?? DEFAULT_COLOR] ?? ICON_COLORS[DEFAULT_COLOR]
}
