export default function InboxLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 animate-pulse">
      <div>
        <div className="h-8 w-24 rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-72 rounded bg-muted/60" />
      </div>
      <div className="h-36 rounded-xl border-2 border-dashed border-border bg-muted/10" />
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
            <div className="size-5 rounded bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted/60" />
            </div>
            <div className="h-3 w-12 rounded bg-muted/60" />
          </div>
        ))}
      </div>
    </div>
  )
}
