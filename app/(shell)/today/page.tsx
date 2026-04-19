export default function TodayPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-heading text-lg font-semibold text-foreground">Today</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Your daily study plan will appear here once Cogni has processed your courses.
      </p>
    </div>
  )
}
