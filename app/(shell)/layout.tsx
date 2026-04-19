import { Sidebar, BottomBar } from './_nav'
import { MotionMain } from './_motion-main'

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden pb-[64px] md:pb-0">
        <MotionMain>{children}</MotionMain>
      </main>

      <BottomBar />
    </div>
  )
}
