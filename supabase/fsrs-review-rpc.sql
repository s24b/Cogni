-- Atomic FSRS + topic mastery update. Replaces the two-step write in
-- /api/cards/review/route.ts so a partial failure can't leave the card
-- marked reviewed without bumping mastery (or vice versa).
--
-- SECURITY DEFINER is required so the function can update topic_mastery
-- across users while still letting a logged-in caller invoke it. The
-- explicit user_id check in the WHERE clause is what enforces the
-- per-user boundary; do not remove it.

create or replace function public.review_card_atomic(
  p_card_id uuid,
  p_user_id uuid,
  p_fsrs_stability numeric,
  p_fsrs_difficulty numeric,
  p_fsrs_reps integer,
  p_fsrs_lapses integer,
  p_fsrs_state integer,
  p_fsrs_last_review timestamptz,
  p_fsrs_next_review_date date,
  p_mastery_delta numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  update public.flashcards
  set fsrs_stability = p_fsrs_stability,
      fsrs_difficulty = p_fsrs_difficulty,
      fsrs_reps = p_fsrs_reps,
      fsrs_lapses = p_fsrs_lapses,
      fsrs_state = p_fsrs_state,
      fsrs_last_review = p_fsrs_last_review,
      fsrs_next_review_date = p_fsrs_next_review_date
  where card_id = p_card_id
    and user_id = p_user_id
  returning topic_id into v_topic_id;

  if not found then
    raise exception 'card not found or not owned by user';
  end if;

  if v_topic_id is not null then
    update public.topic_mastery
    set mastery_score = greatest(0, least(1, coalesce(mastery_score, 0) + p_mastery_delta)),
        last_updated = now()
    where user_id = p_user_id
      and topic_id = v_topic_id;
  end if;
end;
$$;

grant execute on function public.review_card_atomic(
  uuid, uuid, numeric, numeric, integer, integer, integer, timestamptz, date, numeric
) to authenticated, service_role;
