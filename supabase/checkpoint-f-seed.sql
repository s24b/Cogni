-- Checkpoint F seed data
-- Seeds mastery_history (30-day trend) + 2 graded exams for your first course.
-- Run in Supabase SQL Editor. Safe to re-run (deletes [mock] rows first).

DO $$
DECLARE
  v_user_id    uuid;
  v_course_id  uuid;
  v_course2_id uuid;
  v_exam1_id   uuid;
  v_exam2_id   uuid;
  v_topic      RECORD;
  v_day        integer;
  v_base       numeric;
  v_score      numeric;
BEGIN
  SELECT user_id INTO v_user_id FROM public.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found — run onboarding first.';
    RETURN;
  END IF;

  -- Pick first two active courses
  SELECT course_id INTO v_course_id
  FROM public.courses
  WHERE user_id = v_user_id AND active_status = 'active'
  ORDER BY created_at LIMIT 1;

  SELECT course_id INTO v_course2_id
  FROM public.courses
  WHERE user_id = v_user_id AND active_status = 'active'
    AND course_id != v_course_id
  ORDER BY created_at LIMIT 1;

  IF v_course_id IS NULL THEN
    RAISE NOTICE 'No active courses found.';
    RETURN;
  END IF;

  -- ── Clean up previous mock data ─────────────────────────────────────────────
  DELETE FROM public.mastery_history
  WHERE user_id = v_user_id
    AND recorded_at < now() - interval '1 hour';  -- only old entries (keeps today's real data)

  DELETE FROM public.exams
  WHERE user_id = v_user_id
    AND student_score IS NOT NULL
    AND date < now()::date;

  -- ── Mastery history: 30-day snapshots for course 1 topics ──────────────────
  FOR v_topic IN
    SELECT t.topic_id, tm.mastery_score
    FROM public.topics t
    LEFT JOIN public.topic_mastery tm ON tm.topic_id = t.topic_id AND tm.user_id = v_user_id
    WHERE t.course_id = v_course_id
    LIMIT 10
  LOOP
    v_base := COALESCE(v_topic.mastery_score, 0.3);
    -- Insert a snapshot every 3 days going back 30 days, showing gradual improvement
    FOR v_day IN 0..9 LOOP
      -- Start lower 30 days ago, ramp up toward current
      v_score := GREATEST(0, v_base - (0.3 * (1 - v_day::numeric / 9)));
      INSERT INTO public.mastery_history (user_id, topic_id, mastery_score, recorded_at)
      VALUES (
        v_user_id,
        v_topic.topic_id,
        ROUND(v_score::numeric, 2),
        now() - ((9 - v_day) * 3 || ' days')::interval
      );
    END LOOP;
  END LOOP;

  -- ── Mastery history: snapshots for course 2 (if exists) ───────────────────
  IF v_course2_id IS NOT NULL THEN
    FOR v_topic IN
      SELECT t.topic_id, tm.mastery_score
      FROM public.topics t
      LEFT JOIN public.topic_mastery tm ON tm.topic_id = t.topic_id AND tm.user_id = v_user_id
      WHERE t.course_id = v_course2_id
      LIMIT 10
    LOOP
      v_base := COALESCE(v_topic.mastery_score, 0.4);
      FOR v_day IN 0..9 LOOP
        v_score := GREATEST(0, v_base - (0.25 * (1 - v_day::numeric / 9)));
        INSERT INTO public.mastery_history (user_id, topic_id, mastery_score, recorded_at)
        VALUES (
          v_user_id,
          v_topic.topic_id,
          ROUND(v_score::numeric, 2),
          now() - ((9 - v_day) * 3 || ' days')::interval
        );
      END LOOP;
    END LOOP;
  END IF;

  -- ── Graded exams for course 1 (triggers exam score prediction) ─────────────
  -- Exam 1: 25 days ago, mastery was lower → scored 71
  INSERT INTO public.exams (user_id, course_id, date, student_score, duration_minutes, grade_weight)
  VALUES (v_user_id, v_course_id, (now() - interval '25 days')::date, 71, 75, 25)
  RETURNING exam_id INTO v_exam1_id;

  -- Exam 2: 10 days ago, mastery was higher → scored 84
  INSERT INTO public.exams (user_id, course_id, date, student_score, duration_minutes, grade_weight)
  VALUES (v_user_id, v_course_id, (now() - interval '10 days')::date, 84, 75, 25)
  RETURNING exam_id INTO v_exam2_id;

  RAISE NOTICE 'Seeded mastery_history + 2 graded exams for course %', v_course_id;
  IF v_course2_id IS NOT NULL THEN
    RAISE NOTICE 'Also seeded mastery_history for course %', v_course2_id;
  END IF;
END $$;
