## cleanup-drafts Edge Function

Deletes expired draft rows from `drawings` by calling `public.cleanup_expired_drafts`.

### Required env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### Manual test

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/cleanup-drafts" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Suggested schedule

Run every 5 minutes from Supabase Scheduled Functions / external cron.
