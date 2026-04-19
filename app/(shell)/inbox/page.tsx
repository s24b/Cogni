export default function InboxPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-heading text-lg font-semibold text-foreground">Inbox</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Drop syllabuses, lecture notes, and study guides here. Cogni will classify and process them automatically.
      </p>
    </div>
  )
}
