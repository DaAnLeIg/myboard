-- Ownership and draft lifecycle hardening for Google Play readiness.

alter table if exists public.drawings
  add column if not exists owner_token text,
  add column if not exists updated_at timestamptz not null default now();

update public.drawings
set owner_token = coalesce(owner_token, md5(random()::text || clock_timestamp()::text))
where owner_token is null;

alter table public.drawings
  alter column owner_token set not null;

create index if not exists drawings_owner_token_idx on public.drawings(owner_token);
create index if not exists drawings_room_id_idx on public.drawings(room_id);
create index if not exists drawings_updated_at_idx on public.drawings(updated_at desc);

create or replace function public.set_drawings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_drawings_updated_at on public.drawings;
create trigger trg_drawings_updated_at
before update on public.drawings
for each row execute function public.set_drawings_updated_at();

alter table public.drawings enable row level security;

drop policy if exists drawings_select_own on public.drawings;
create policy drawings_select_own
on public.drawings
for select
to anon, authenticated
using (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);

drop policy if exists drawings_insert_own on public.drawings;
create policy drawings_insert_own
on public.drawings
for insert
to anon, authenticated
with check (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);

drop policy if exists drawings_update_own on public.drawings;
create policy drawings_update_own
on public.drawings
for update
to anon, authenticated
using (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
)
with check (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);

drop policy if exists drawings_delete_own on public.drawings;
create policy drawings_delete_own
on public.drawings
for delete
to anon, authenticated
using (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);

-- Cleanup RPC can be called by service_role from Edge Function.
create or replace function public.cleanup_expired_drafts(p_before timestamptz default now() - interval '5 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.drawings d
  where d.room_id like 'draft:%'
    and coalesce(d.updated_at, d.created_at) < p_before;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_drafts(timestamptz) from public;
grant execute on function public.cleanup_expired_drafts(timestamptz) to service_role;
