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
