// Server-safe: no React imports. Used by API routes.

export const ICON_NAMES = [
  'Article', 'Atom', 'BookBookmark', 'BookOpen', 'BookOpenText',
  'Brain', 'BracketsCurly', 'Calculator', 'ChartBar', 'ChartLine',
  'Code', 'Coins', 'Compass', 'Cpu', 'Dna', 'Flask',
  'GraduationCap', 'Globe', 'Heartbeat', 'Leaf',
  'Lightbulb', 'MathOperations', 'Microscope', 'MusicNotes',
  'PaintBrush', 'Palette', 'Pencil', 'Ruler', 'Scales',
  'Scroll', 'Sigma', 'Star', 'Terminal', 'TestTube', 'Translate', 'Lightning',
] as const

export type IconColorId = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'indigo'

export const ICON_COLOR_IDS: IconColorId[] = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'orange', 'indigo']
