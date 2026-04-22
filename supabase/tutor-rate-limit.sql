-- Phase 24: daily tutor message rate limit
-- Adds an optional per-user daily message cap for the Tutor.
-- null = no limit (default).

alter table public.users
  add column if not exists daily_message_limit integer;
