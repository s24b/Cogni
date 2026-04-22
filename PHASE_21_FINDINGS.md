# Phase 21 — Audit Findings

Branch-scoped log of findings, decisions, and fixes from the Phase 21 audit.
Delete this file before merging `phase-21-audit` into `main`.

---

## Session 1 — Dev cleanup + content_coverage fix (commit `68a75c2`)

### Changed
- Removed 10 debug `console.log` calls (profiler 7, scheduler 1, tutor 1, nudge 1, onboarding 1). Kept `console.error` in catch blocks — they stream to Vercel logs for error observability.
- Added inline justification comments for `no-require-imports` suppressions on `pdf-parse` / `sharp` (must lazy-load — top-level import crashes in Next.js build/runtime).
- Deleted 4 diagnostic SQL files: `check-topics.sql`, `checkpoint-f-seed.sql`, `diagnose-vault.sql`, `mock-calculus-coursework.sql`.
- Fixed `content_coverage`: flashcard agent + tutor `create_flashcards` tool now write `min(1.0, card_count / 10)` per topic after insert. Created `supabase/content-coverage-backfill.sql` and Arshawn ran it in prod.

### Verified unchanged
- Dev routes (`/api/dev/reset`, `/api/dev/reprofile`, `/api/calendar/test`) already `NODE_ENV`-gated.
- `DevResetButton` in Settings already `isDev`-gated.

---

## Session 2 — Gap detection (no commit, read-only)

### Passing checks (6/9)
- **`examProximityMultiplier`** — profiler writes to `exams` (profiler.ts:351); scheduler reads; values 1/1.5/2/3/5 produced based on days-to-exam.
- **`professor_weight`** — Claude extracts, profiler inserts/updates (profiler.ts:282, 298). Defaults to 0.5 only when Claude omits the field.
- **Scheduler task types vs Today client** — all 4 `TaskItem` types (flashcard_review, homework, practice_quiz, insight) filtered and rendered in `app/(shell)/today/_client.tsx` lines 328–331.
- **`generateUpcomingPreview` staleness** — `scheduler.ts:380` `if (existing) continue` skips days with cached plans.
- **RAG chunks** — top-5 retrieved (`tutor/route.ts:118`), joined and injected verbatim into system prompt (`tutor.ts:108–110`). ~4k tokens, well within budget.
- **Silent fallbacks (`?? 0` / `?? 0.5`)** — 14 occurrences audited; all legitimate defaults. No masked upstream gaps.

### Gaps found (scheduled for later sessions)
- **FSRS + mastery atomicity** (→ Session 3): `/api/cards/review/route.ts` does two non-transactional writes. The mastery update at lines 62–66 has **no error check** and the route still returns `ok: true` if it fails. Partial-write scenarios possible.
- **Dead route `/api/flashcards/review`** (→ Session 4): FSRS-only, never called by any client. Delete.
- **Inbox silent catch on `runFlashcardAgent`** (→ Session 3): `inbox.ts:317` `.catch(() => {})` swallows card-generation failures silently. Fire-and-forget by design, but user sees no error. Decide whether to surface.
- **Wiki injection full-file** (→ Session 6): tutor injects `learning_profile.md`, `weak_areas.md`, `professor_<id>.md` in full. Bounded by generator today, not enforced. Add slice guard or document assumption.

### Agent outputs all consumed
Profiler → topics/exams/wiki (scheduler, tutor, practice-quiz). Flashcard → cards/content_coverage (review UI, simulated exam). Scheduler → study_plan (today). Nudge → nudges (today). Inbox → materials (RAG, flashcard agent). Tutor → messages, cards, quiz results (tutor UI).

---

## Session 3 — Bug sweep (commit pending)

### Fixed
- **Nudge cron had no auth and wrong method.** Route only exported `POST` while Vercel cron issues `GET` with `Authorization: Bearer $CRON_SECRET`. Net result: the nudge cron has never actually authenticated, and very likely never ran (405). Rewrote as `GET` with Bearer check, matching the scheduler cron's pattern.
- **Calendar OAuth callback trusted `state` blindly.** `state` was the user_id with no session binding — an attacker with their own Google OAuth flow could forge a callback with `state=<victim_user_id>` and write their tokens onto the victim's row. Fixed by calling `auth.getUser()` in the callback and rejecting when `session.user.id !== stateUserId`.
- **FSRS + topic_mastery non-atomicity (Session 2 finding).** Replaced the two separate writes in `/api/cards/review/route.ts` with a single `review_card_atomic(...)` Postgres function (new file `supabase/fsrs-review-rpc.sql`). The RPC updates both rows in one transaction, clamps mastery in SQL, and raises if the card isn't owned by the user. Callable path now surfaces any failure instead of silently swallowing it.

### Verified unchanged (no bug)
- **Auth boundary:** all other 40 API routes call `auth.getUser()` and return 401 before any data access. Dev routes gated on `NODE_ENV`.
- **Tutor session lifecycle:** `getOrCreateSession` reuses today's open session; `autoNameSession` is fire-and-forget with internal try/catch (cannot produce unhandled rejection); `X-Session-Id` returned to client on first response.
- **Streaming:** only the tutor route uses `ReadableStream`. Both success (line 463) and error (line 473) paths call `controller.close()`.
- **Scheduler edge cases:** early returns on 0 courses (line 96), skips courses with 0 topics (line 133), early returns on 0 tasks (line 312), uses `upsert({onConflict:'user_id,plan_date'})` to prevent double-writes, calendar write is fire-and-forget with `.catch` logging.
- **Calendar writes non-blocking:** `writeStudyBlocksToCalendar(...).catch(e => console.error(...))` — never blocks the scheduler.
- **RLS coverage:** 20 user-scoped tables across `schema.sql` and patch files — every one has `enable row level security` and an `auth.uid() = user_id` policy. Includes `user_keys`, `calendar_connections`, `practice_test_results`, `course_files`.

### Noted but not fixed (out-of-scope / trivial)
- **Onboarding refresh-during-submit edge case:** `page.tsx` redirects to `/today` if the `users` row already exists, so the only duplication risk is during a partial-failure retry where `users` insert never happened. In that case the retry is the correct path. No fix.
- **`appendToLog` race on log.md:** read-modify-write pattern; concurrent writes can drop log entries. Not corruption — just informational data loss. Low severity, no fix.
- **Inbox `runFlashcardAgent(...).catch(() => {})`:** silent catch is intentional fire-and-forget after classification. UI-level error surfacing would require new UX; deferred.

### Operations required before / during next deploy
1. Run `supabase/fsrs-review-rpc.sql` in the Supabase SQL editor.
2. Confirm `CRON_SECRET` env var is set in Vercel. (If not set, nudge cron will fail 401 — intended; set the secret and re-deploy.)
