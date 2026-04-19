'use client'

import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'

// ── Shared easing ────────────────────────────────────────────────────────────
export const ease = [0.22, 1, 0.36, 1] as const

// ── Reusable variants ─────────────────────────────────────────────────────────
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease } },
}

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055 } },
}

// ── FadeUp: entrance animation for individual elements ────────────────────────
type FadeUpProps = HTMLMotionProps<'div'> & { delay?: number }

export function FadeUp({ delay = 0, children, ...props }: FadeUpProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.22, ease, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ── StaggerList: staggered entrance for lists ─────────────────────────────────
export function StaggerList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── StaggerItem: individual item inside StaggerList ───────────────────────────
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  )
}

// ── PressCard: interactive card with hover/tap ────────────────────────────────
export function PressCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={{ scale: 1.003, transition: { duration: 0.15, ease } }}
      whileTap={{ scale: 0.993, transition: { duration: 0.1 } }}
    >
      {children}
    </motion.div>
  )
}
