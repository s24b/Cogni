-- Backfill topics.content_coverage based on existing flashcard counts.
-- Coverage = min(1.0, card_count / 10). Run once after deploying the flashcard
-- agent change that writes coverage on insert. Safe to re-run: deterministic.

update public.topics t
set content_coverage = least(
  1.0,
  (
    select count(*)::numeric / 10
    from public.flashcards f
    where f.topic_id = t.topic_id
  )
);
