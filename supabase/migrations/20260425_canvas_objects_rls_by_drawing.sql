-- RLS for canvas_objects: INSERT/UPDATE/SELECT/DELETE разрешены, если запись относится к доске,
-- к которой у вызывающего есть доступ — та же логика, что у public.drawings:
-- заголовок x-owner-token (anon/client) должен совпадать с drawings.owner_token по drawing_id.
--
-- Примените после 20260424_drawings_owner_rls_and_draft_cleanup.sql
-- (должны существовать public.drawings (id) и public.canvas_objects (drawing_id).

alter table if exists public.canvas_objects enable row level security;

-- Supabase: для Realtime по таблице включите публикацию (в SQL editor или дашборде):
--   alter publication supabase_realtime add table public.canvas_objects;
-- (если таблица ещё не в publication)

drop policy if exists canvas_objects_select_by_drawing on public.canvas_objects;
create policy canvas_objects_select_by_drawing
on public.canvas_objects
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.drawings d
    where d.id = public.canvas_objects.drawing_id
      and d.owner_token = coalesce(
        current_setting('request.headers', true)::json->>'x-owner-token',
        ''
      )
  )
);
-- Тот же шаблон, что в policies на public.drawings (x-owner-token → myboard_owner_token в клиенте)

drop policy if exists canvas_objects_insert_by_drawing on public.canvas_objects;
create policy canvas_objects_insert_by_drawing
on public.canvas_objects
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.drawings d
    where d.id = public.canvas_objects.drawing_id
      and d.owner_token = coalesce(
        current_setting('request.headers', true)::json->>'x-owner-token',
        ''
      )
  )
);

drop policy if exists canvas_objects_update_by_drawing on public.canvas_objects;
create policy canvas_objects_update_by_drawing
on public.canvas_objects
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.drawings d
    where d.id = public.canvas_objects.drawing_id
      and d.owner_token = coalesce(
        current_setting('request.headers', true)::json->>'x-owner-token',
        ''
      )
  )
)
with check (
  exists (
    select 1
    from public.drawings d
    where d.id = public.canvas_objects.drawing_id
      and d.owner_token = coalesce(
        current_setting('request.headers', true)::json->>'x-owner-token',
        ''
      )
  )
);

-- Удаление объектов (и Realtime DELETE), если досе принадлежит тот же владелец
drop policy if exists canvas_objects_delete_by_drawing on public.canvas_objects;
create policy canvas_objects_delete_by_drawing
on public.canvas_objects
for delete
to anon, authenticated
using (
  exists (
    select 1
    from public.drawings d
    where d.id = public.canvas_objects.drawing_id
      and d.owner_token = coalesce(
        current_setting('request.headers', true)::json->>'x-owner-token',
        ''
      )
  )
);
