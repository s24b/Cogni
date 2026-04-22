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

### Gap noted for Session 6 (token/wiki scope) — RESOLVED 2026-04-21
The tutor system prompt no longer injects `weak_areas.md` (the unused fetch was removed). **Decision (Arshawn, 2026-04-21): option (c) — keep the file profiler-only.** The profiler continues to write `weak_areas.md`; nothing in the tutor path reads it. The tutor still injects the bottom-10 weak topics from `topic_mastery`, which covers the tutor's needs. Rationale: the narrative-style weak-area file is useful for the profiler to track drift across runs, but the mastery score list is sufficient signal for the tutor. No Session 6 action required on this item — just confirm the profiler still writes it and no other code reads it.

### Operations required before / during next deploy
No new ops for Session 4. Session 3's list still applies:
1. Run `supabase/fsrs-review-rpc.sql` in the Supabase SQL editor.
2. Confirm `CRON_SECRET` env var is set in Vercel.

---

## Session 5 — DB + query efficiency (commit pending)

### Fixed (N+1 patterns)
- **`lib/agents/scheduler.ts:runScheduler` first per-course loop.** Previously did 3 queries × N courses (topics, topic_mastery, due flashcards). Replaced with 3 total queries using `.in('course_id', courseIds)` + Map-based grouping in memory. For a user with 6 active courses this drops 18 DB round trips to 3.
- **`lib/agents/scheduler.ts:runScheduler` quiz-candidates loop.** Was 2 queries × N courses (`practice_test_results` latest + `flashcards` count). Now 2 total: one `.in('course_id', courseIds)` query ordered by `created_at desc` → first hit per course is the latest; one `.in('course_id', courseIds)` card fetch tallied into `cardCountByCourse` Map.
- **`lib/agents/scheduler.ts:generateUpcomingPreview`.** Worst N+1 in the codebase — nested loop did 6 days × (1 plan-exists check + N per-course due-cards query + 1 assignments query) = up to 6 + 6N + 6 queries, plus 6 per-day inserts. Rewrote as 3 batched queries across the full 6-day window (`study_plan` by `plan_date in dateStrs`, `flashcards` by `course_id in courseIds AND fsrs_next_review_date in dateStrs`, `assignments` with range `gte windowStart, lt windowEndExclusive`) + 1 batched `insert(rowsToInsert)` at the end. For 6 courses × 6 days: ~43 queries → 4.
- **`lib/agents/practice-quiz.ts:gradeAndRecord`.** The resolved-topics loop used to do 2 queries per matched topic (topic lookup + mastery fetch). Replaced with one `.eq('course_id', courseId)` topics fetch and one `.in('topic_id', topicIds)` mastery fetch, followed by a single `upsert` for mastery and single `insert` for `mastery_history`.
- **`lib/agents/profiler.ts` existing-topic weight updates.** Was sequential `await service.from('topics').update(...).eq(...)` inside a for-loop. Converted to `Promise.all` parallel updates. Still N queries but issued concurrently, cutting wall-clock from N × RTT to ~1 × RTT. (A bulk CASE/upsert would require refactoring the `existingTopics` select to include all non-nullable columns — out of scope.)
- **`lib/agents/profiler.ts` per-exam check-then-insert.** Was 1 existence check + 1 insert per exam. Replaced with a single `.in('date', futureDates)` existence query + one batched `insert(examRowsToInsert)`.

### Verified unchanged
- **RLS coverage** (re-verified). All 17 tables in `schema.sql` plus `practice_test_results`, `course_files`, `user_keys`, `calendar_connections` have `enable row level security` and an `auth.uid() = user_id` policy. No table is exposed.
- **Index coverage for the new batched queries.**
  - `topics(course_id)` — covers `from('topics').in('course_id', courseIds)`.
  - `flashcards(user_id, course_id)` + `flashcards(fsrs_next_review_date)` — covers both scheduler flashcards queries.
  - `topic_mastery(user_id, topic_id)` — covers `.eq('user_id').in('topic_id', topicIds)`.
  - `assignments(user_id, due_date)` — covers `gte`/`lt` window filters.
  - `study_plan UNIQUE(user_id, plan_date)` — auto-indexed, covers `plan_date in dateStrs`.
  - `exams(course_id, date)` — covers profiler's batched existence check.
- **Storage bucket policies.** Four buckets in use: `course-files`, `materials`, `wiki`, `audio`. `course-files` has explicit `storage.objects` RLS policies in `supabase/course-files.sql` (owner_upload/read/delete keyed on `auth.uid() = (storage.foldername(name))[1]`). All reads/writes to `materials`, `wiki`, `audio` go through route handlers using the **service client** (`createServiceClient`), which bypasses RLS — these are server-only, never exposed to browser clients. No client-side storage exposure.
- **Atomic FSRS RPC** (Session 3) still the only path hit by `/api/cards/review`.

### Gaps noted but not fixed
- **`practice_test_results` has no index** on `(user_id, course_id, created_at)`. The new batched scheduler query `.eq(user_id).in(course_id).order(created_at desc)` will full-scan the table. Low severity today (few rows per user) but worth adding as usage grows. **Action:** add `create index on public.practice_test_results(user_id, course_id, created_at desc);` in a future migration.
- **Storage buckets `materials`, `wiki`, `audio` have no SQL-defined `storage.objects` policies.** They're configured via the Supabase dashboard (or rely on the service-client bypass). If any client-side code ever touches these buckets directly, it will be unprotected. **Action:** mirror the `course-files` owner-read policy pattern into a migration for consistency.

### Performance impact (illustrative, 6-course user)
- `runScheduler`: ~24 queries → ~9 queries (~63% drop).
- `generateUpcomingPreview`: ~43 queries → ~4 queries (~90% drop).
- `gradeAndRecord` (20-question quiz hitting 8 topics): ~18 queries → ~5 queries (~72% drop).
- `runProfiler` with 10 existing topics + 4 exams: from 14 sequential RTTs → 2 batched + 1 parallel wave (N remains but concurrent).

### Operations required before / during next deploy
No new ops for Session 5. Session 3's list still applies. Future-optional: add the two indexes flagged above.

---

## Session 6 — Token + API cost (commit pending)

### Fixed
- **`lib/agents/tutor.ts` Teach-mode prompt — stale `weak_areas.md` reference removed.** The wiki-check list in `MODE_INSTRUCTIONS.teach` named `weak_areas.md` as a place to look for familiarity evidence. Tutor no longer reads that file (Session 4 decision). Replaced with generic "learning profile or current weak-topics list" phrasing so the model doesn't hallucinate looking for a file that isn't in its system prompt.
- **`app/api/agents/tutor/route.ts` `write_wiki_pattern` tool — enum narrowed.** Previously accepted `weak_areas.md` as a write target, which violates the 2026-04-21 profiler-only decision (a tutor-driven append would have silently mutated a file the profiler assumes it owns). Enum now restricted to `['learning_profile.md']`.
- **`app/api/agents/audio-overview/route.ts` word target tightened.** Script prompt asked for "2,500–3,500 words" but `max_tokens: 4096` caps output at ~3,150 words, so the upper bound was unreachable and runs were silently truncating. Trimmed target to "2,500–2,800 words" to match the actual ceiling; keeps the same study-length podcast, no cost increase.

### Verified — model assignments
Audited every `client.messages.create(...)` call across 7 files. All assignments are deliberate:

| Agent / call site | Model | Role |
| --- | --- | --- |
| Inbox classification (`inbox.ts:126,217,231`) | Haiku 4.5 | structured JSON classification |
| Inbox vision text extraction (`inbox.ts:126`) | Haiku 4.5 | OCR-style transcription |
| Profiler topic + exam extraction (`profiler.ts:28`) | Haiku 4.5 | structured JSON extraction from syllabus |
| Profiler professor profile (`profiler.ts:100`) | Haiku 4.5 | short markdown summary (<400 words) |
| Flashcard generation (`flashcard.ts:16`) | Haiku 4.5 | 6–10 cards per topic |
| Practice quiz generation (`practice-quiz.ts:92`) | Haiku 4.5 | question generation |
| Simulated exam (`practice-quiz.ts:176`) | Sonnet 4.6 | realistic exam emulation |
| Short-answer grading (`practice-quiz.ts:247`) | Haiku 4.5 | score 0.0–1.0 with feedback |
| Session auto-name (`tutor.ts:249`) | Haiku 4.5 | 2–4 word title |
| Course icon picker (`courses/create/route.ts:16`) | Haiku 4.5 | icon + color choice |
| Audio overview script (`audio-overview/route.ts:133`) | Sonnet 4.6 | podcast-style dialogue |
| Tutor main loop (`tutor/route.ts:274`) | Sonnet 4.6 / Opus 4.7 | interactive teaching |

**Spec deviations (two) — deliberate cost choices, flagged but not changed:**
- Checklist says Profiler should use Sonnet. Actually uses Haiku 4.5. Task is deterministic JSON extraction; Haiku is sufficient. Upgrading would cost ~10× per run with marginal quality improvement.
- Checklist says "verification grading" should use Sonnet. Short-answer grading uses Haiku 4.5 at 200 max_tokens. Task is a bounded rubric check against a model answer; Haiku is sufficient. If Arshawn wants higher-quality written feedback, we can upgrade.

### Verified — extended thinking gating
`app/api/agents/tutor/route.ts:274-285`:
```
model: deepThink ? 'claude-opus-4-7' : 'claude-sonnet-4-6',
max_tokens: deepThink ? 16000 : 4096,
if (deepThink) {
  streamParams.thinking = { type: 'adaptive' }
  streamParams.output_config = { effort: 'high' }
}
```
Extended thinking only activates when the client passes `deepThink: true`. The default path (Sonnet 4.6, 4096 cap, no thinking) is what 99% of requests hit. Cost-gated correctly. (Note: uses Opus 4.7 adaptive thinking, not the `budget_tokens: 8000` pattern the checklist mentioned — the checklist predates the Opus 4.7 API; current implementation is the correct equivalent.)

### Verified — RAG top-K bounding
`lib/rag.ts:retrieveChunks` defaults to `topK = 5`; callers pass an explicit top-K:
- Tutor (`tutor/route.ts:118`) — 5 chunks.
- Profiler professor wiki enrichment (`profiler.ts:388`) — 4 chunks.
Query input to the embedding call is sliced to 2000 chars (`rag.ts:115`). No full-document injection. Chunks are ~800 tokens each, so worst case tutor injects ~4,000 tokens of RAG context, well within the model's window.

### Verified — wiki scope in system prompts
- `learning_profile.md` is injected full-file by `buildTutorSystemPrompt`, but the generator (`profiler.buildLearningProfile`) produces a compact markdown list (~500 tokens for a 6-course user). Bounded by construction.
- `professor_<id>.md` is injected full-file, generator prompt caps at "under 400 words" (~600 tokens). Bounded by construction.
- `weak_areas.md` is NOT read by any agent — profiler writes it as a standalone artifact. Confirmed by grepping for `readWikiFile(.*weak_areas)` — only hit is in the profiler's own self-rebuild path.
- Bottom-10 weak topics are instead pulled from `topic_mastery` directly in `buildTutorSystemPrompt` (line 76–89), which is cheap and always fresh.

### Verified — max_tokens caps per call
Audited all 13 `messages.create` sites. All caps right-sized after the audio fix:
- Tight (200–512): short-answer grading 200, inbox classification 512 × 2, session naming 20, course icon 60. Optimal.
- Mid (1024–4096): profiler professor profile 1024, profiler topic extract 2048, flashcard batch 2048, vision text extract 4096, inbox text-path classification uses 512 (not 4096 — 4096 only applies to the separate text-extract call), practice quiz 4096, tutor default 4096, audio script 4096. Right-sized for expected output volumes.
- Large (8192–16000): simulated exam 8192 (20-question Sonnet run), tutor deepThink 16000 (Opus extended thinking). Bounded by explicit user opt-in.

### Operations required before / during next deploy
No new ops for Session 6. Session 3's list still applies.
