-- К колонке drawing_id: Supabase-таблица public.canvas_objects (см. RLS 20260425) должна
-- связывать объекты с public.drawings.id. Это **не** параметр ?room= (коллаборация).
--
-- Если у вас таблица создаётся вручную, убедитесь, что drawing_id существует.

DO $$
BEGIN
  IF to_regclass('public.canvas_objects') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'canvas_objects'
        AND column_name = 'drawing_id'
    ) THEN
      ALTER TABLE public.canvas_objects ADD COLUMN drawing_id text;
    END IF;
  END IF;
END
$$;
