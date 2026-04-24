## Supabase Jobs

### 1) Apply migration

Run SQL from `supabase/migrations/20260424_drawings_owner_rls_and_draft_cleanup.sql`.

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
