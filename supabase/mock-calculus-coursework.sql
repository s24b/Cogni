-- Mock coursework for AP Calculus AB
-- Run in Supabase SQL Editor after onboarding with the Calculus syllabus.
-- Inserts overdue + due-today assignments so the scheduler generates homework blocks.

DO $$
DECLARE
  v_user_id   uuid;
  v_course_id uuid;
BEGIN
  -- Grab the first user (your test account)
  SELECT user_id INTO v_user_id FROM public.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found — run onboarding first.';
    RETURN;
  END IF;

  -- Find the Calculus AB course (matches "calc", "calculus", "AP Calculus", etc.)
  SELECT course_id INTO v_course_id
  FROM public.courses
  WHERE user_id = v_user_id
    AND name ILIKE '%cal%'
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'No Calculus course found — complete onboarding with the Calculus syllabus first.';
    RETURN;
  END IF;

  -- Clear any previous mock assignments for this course so re-runs are idempotent
  DELETE FROM public.assignments
  WHERE user_id = v_user_id
    AND course_id = v_course_id
    AND name ILIKE '%[mock]%';

  -- Insert mock assignments
  INSERT INTO public.assignments (user_id, course_id, name, due_date, type, completion_status) VALUES
    -- Overdue
    (v_user_id, v_course_id, '[mock] Limits & Continuity Problem Set', now() - interval '3 days', 'homework', 'pending'),
    (v_user_id, v_course_id, '[mock] Derivative Rules Quiz',           now() - interval '1 day',  'quiz',     'pending'),
    -- Due today
    (v_user_id, v_course_id, '[mock] Related Rates Worksheet',         now(),                     'homework', 'pending'),
    -- Upcoming (not picked up by scheduler yet, but visible in Courses)
    (v_user_id, v_course_id, '[mock] Riemann Sums Practice',           now() + interval '3 days', 'homework', 'pending'),
    (v_user_id, v_course_id, '[mock] Integration Techniques Review',   now() + interval '7 days', 'homework', 'pending');

  RAISE NOTICE 'Inserted mock assignments for course %', v_course_id;
END $$;
