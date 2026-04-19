export default function CoursesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 animate-pulse">
      <div>
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-56 rounded bg-muted/60" />
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="size-9 shrink-0 rounded-lg bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted/60" />
              </div>
              <div className="h-3 w-16 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
