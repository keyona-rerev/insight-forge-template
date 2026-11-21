-- Lessons learned from the owner's Revise notes. Each row is one general
-- rule for future drafts, written by the editor from the owner's notes.
-- Every draft generator reads the active rows; the owner can remove any
-- on the Strategy page.
CREATE TABLE IF NOT EXISTS public.writing_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson text NOT NULL,
  source_draft_id uuid REFERENCES public.drafts(id) ON DELETE SET NULL,
  source_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS writing_lessons_user_active_idx
  ON public.writing_lessons (user_id, is_active, created_at DESC);

-- The same lesson is only stored once per owner.
CREATE UNIQUE INDEX IF NOT EXISTS writing_lessons_user_lesson_uniq
  ON public.writing_lessons (user_id, lower(lesson));

ALTER TABLE public.writing_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own writing_lessons" ON public.writing_lessons;
CREATE POLICY "Users manage own writing_lessons" ON public.writing_lessons
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
