import { Sidebar, BottomBar } from './_nav'

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-y-auto pb-[64px] md:pb-0">
        {children}
      </main>

      <BottomBar />
    </div>
  )
}
