import { DevResetButton } from './_dev-reset'

export default function SettingsPage() {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API keys, study preferences, calendar, appearance, and account — Phase 19.
        </p>
      </div>

      {isDev && (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Developer tools</p>
          <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-500/80">
            Only visible in development. Never shown in production.
          </p>
          <div className="mt-4">
            <DevResetButton />
          </div>
        </div>
      )}
    </div>
  )
}
