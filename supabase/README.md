## Supabase Jobs

### 1) Apply migrations (in order)

1. `supabase/migrations/20260424_drawings_owner_rls_and_draft_cleanup.sql` (drawings + `owner_token`)
2. `supabase/migrations/20260425_canvas_objects_rls_by_drawing.sql` (RLS on `canvas_objects` by `drawing_id` + same `x-owner-token` as parent `drawings` row)
3. `supabase/migrations/20260426_canvas_objects_ensure_drawing_id.sql` (колонка `drawing_id`, если таблицу ещё создали вручную)

В `canvas_objects` поле `drawing_id` = `public.drawings.id` (из URL: `?id` / `?drawing`). Параметр `?room=` (коллаборация) **не** записывайте в `drawing_id`.

For **Realtime** on `canvas_objects`, if not already added:

`alter publication supabase_realtime add table public.canvas_objects;`

### 2) Deploy Edge Function

```bash
supabase functions deploy cleanup-drafts
```

Set secrets:

```bash
supabase secrets set CRON_SECRET=...
```

### 3) Schedule cleanup (every 5 minutes)

Call:

`POST /functions/v1/cleanup-drafts` with header `Authorization: Bearer <CRON_SECRET>`.

You can configure this from Supabase Scheduled Functions or any external cron.
