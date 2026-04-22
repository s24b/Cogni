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

---

## Session 4 — Code audit (commit pending)

### Fixed
- **Deleted dead route `/api/flashcards/review/route.ts`** (Session 2 finding). FSRS-only, never called by any client — all client reviews go to `/api/cards/review`.
- **Unused imports / vars removed** across 7 files. Warnings were masking the signal of real issues in `npm run lint` output:
  - `app/(shell)/today/_client.tsx` — `AnimatePresence`.
  - `app/(shell)/tutor/_client.tsx` — `PanelGroup`, `Panel`, `PanelResizeHandle`, `BookOpen`, `ArrowsIn`.
  - `app/(shell)/courses/[courseId]/_client.tsx` — `ease`.
  - `app/(shell)/courses/[courseId]/materials/_client.tsx` — unused `courseId` prop dropped from signature + parent `page.tsx`.
  - `app/(shell)/settings/_knowledge-store.tsx` — unused `filename` param on `DeleteWarning` + unused `professorMap` prop on `WikiFileRow` dropped from both sites.
  - `app/(shell)/inbox/_client.tsx` — removed dead `skipDueDate` function (only referenced in a comment).
  - `components/essay/EssayEditor.tsx` — `TextHOne/Two/Three`, unused `to` destructure.
  - `lib/agents/tutor.ts` — removed unused `weakAreas` wiki fetch (wiki file `weak_areas.md` is generated by the profiler but **no longer read into the tutor system prompt**). See note below — this is a real gap to decide on in Session 6.
- **Stale `eslint-disable-next-line` directives removed** from `lib/agents/profiler.ts`, `lib/fsrs.ts`, `app/(shell)/progress/page.tsx` — the rules they silenced no longer fire; leaving them in made future suppressions harder to audit.
- **`QuizSession.tsx:781` — ref mutation during render.** `onExpireRef.current = ...` was assigned in the component body, which breaks under React 19's concurrent rendering and triggers the new `react-hooks/refs` error. Moved into a `useEffect` with `[submitAnswers, userAnswers, questions]` deps so the ref always reflects the latest closure without tearing.
- **Silent fire-and-forget `.catch(() => {})` replaced with `console.error`** in 3 API routes (`courses/create` icon assignment, `inbox/upload` scheduler rerun, `settings/session-length` scheduler rerun). Background failures now stream to Vercel logs instead of vanishing.
- **Unescaped apostrophe** in `QuizSession.tsx:387` — swapped for `&apos;`.

### Verified unchanged (no bug, intentional patterns)
- **`as any` casts** across `tutor/route.ts` (Anthropic SDK streaming event discriminated union gap), `EssayEditor.tsx` (Tiptap chain extensions), `tutor/_client.tsx` (browser SpeechRecognition), `progress/page.tsx` / `courses/[courseId]/page.tsx` / `courses/[courseId]/materials/page.tsx` (Supabase join result casts — per project convention, deferred to when DB types are generated).
- **`lib/supabase/server.ts` `require('@supabase/supabase-js')`** — tried converting to a typed ESM import; the typed client narrows join return types, which cascaded into ~8 type errors across `lib/agents/*` that treat joins as `any`. Reverted and added an inline justification comment. Lint suppression is now documented. Full fix requires generating DB types from Supabase and retyping every agent join — out of scope for Phase 21.
- **`useEffect` cleanup / deps.** All 23 `useEffect`s across client components reviewed. `CountdownTimer` clears its interval, `courses/[courseId]/_client.tsx` audio listeners remove properly, essay autosave clears the debounce timer, all click-outside handlers remove their listeners. `onboarding/_client.tsx:360` deliberately uses `eslint-disable react-hooks/exhaustive-deps` because `runCompletion` would infinite-loop if added — correct.
- **Framer Motion `layout`/`layoutId` props.** Grepped — no usages in the codebase, so the "escaping `overflow-hidden`" risk flagged on the checklist is N/A.
- **Consistent error handling in routes.** Spot-checked every route with try/catch: each `catch` returns `NextResponse.json({ error }, { status })`. The only remaining silent catches are the 3 fixed above plus the intentional `.catch(() => {})` in `lib/agents/inbox.ts:317` (Session 2 finding, UI-surface work deferred).
- **Streaming responses closed.** Already confirmed in Session 3.

### Known-but-deferred (remaining `npm run lint` errors — not blockers)
These are new React 19 lint rules that fire on legitimate patterns. No behavior bug, no fix this session.
- **`react-hooks/static-components`** — 4 sites where an icon component is looked up from a map (`const IC = resolveIcon(...)` → `<IC ... />`). This is a dynamic-icon lookup, not a new component. A refactor to `React.createElement(resolveIcon(...), props)` is cosmetic; skipping.
- **`react-hooks/set-state-in-effect`** — 7 sites. Most are the standard `useEffect(() => setMounted(true), [])` SSR-safe mount pattern; one is `onboarding/_client.tsx:188` (syllabus sync, could be derived state but works correctly). These are not logic bugs.
- **`app/(shell)/progress/page.tsx:32` Cannot call impure function during render** — `notFound()` from Next.js, called during server-component render. Intentional Next.js pattern.
- **`next lint` invocation** — `npx next lint` fails with "invalid project directory" (Next 16 regression on this repo's directory name). Use `npm run lint` (which calls `eslint` directly) instead.

### Gap noted for Session 6 (token/wiki scope)
The tutor system prompt no longer injects `weak_areas.md` (the unused fetch was removed). The profiler still writes the file, and we still inject **weak *topics* from `topic_mastery`** into the prompt — so weak-area context is not fully lost. But the wiki file itself is currently write-only. Session 6 should decide: (a) inject it bounded, (b) stop generating it, or (c) use it only inside the profiler's own loop.

### Operations required before / during next deploy
No new ops for Session 4. Session 3's list still applies:
1. Run `supabase/fsrs-review-rpc.sql` in the Supabase SQL editor.
2. Confirm `CRON_SECRET` env var is set in Vercel.
