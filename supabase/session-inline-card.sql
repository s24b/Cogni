-- Add inline_card column to session_messages to persist artifact payloads
-- (flashcards, quiz questions, essay open events) so they survive session reload.
alter table public.session_messages
  add column if not exists inline_card jsonb;
