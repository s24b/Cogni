export default function TodayLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 animate-pulse">
      <div>
        <div className="h-8 w-56 rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-44 rounded bg-muted/60" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-24 rounded bg-muted/60" />
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
            <div className="size-10 shrink-0 rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-36 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
