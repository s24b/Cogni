'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { ease } from '@/components/ui/motion'

export function MotionMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        className="flex flex-1 flex-col min-h-0 overflow-hidden"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
