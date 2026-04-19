-- Add streak tracking to users table
alter table public.users
  add column if not exists study_streak integer not null default 0,
  add column if not exists last_study_date date;
