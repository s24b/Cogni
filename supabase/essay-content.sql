-- Add essay content persistence to session_log
-- Run in Supabase SQL editor
alter table public.session_log add column if not exists essay_content text;
