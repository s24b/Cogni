export default function TutorLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 animate-pulse">
      <div className="h-8 w-28 rounded-lg bg-muted" />
      <div className="flex flex-1 flex-col gap-3">
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-xl border border-border bg-muted/20" />
        ))}
      </div>
    </div>
  )
}
