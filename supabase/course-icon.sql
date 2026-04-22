-- Add icon and icon_color columns to courses
alter table public.courses add column if not exists icon text;
alter table public.courses add column if not exists icon_color text default 'blue';
