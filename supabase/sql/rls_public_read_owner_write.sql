-- RLS for drawings:
-- - anyone can read (public boards)
-- - anyone can create
-- - only owner can update/delete
--
-- Owner is determined by x-owner-token header (client sets it from localStorage key myboard_owner_token).

alter table if exists public.drawings
  add column if not exists owner_token text;

update public.drawings
set owner_token = coalesce(owner_token, md5(random()::text || clock_timestamp()::text))
where owner_token is null;

alter table public.drawings
  alter column owner_token set not null;

create index if not exists drawings_owner_token_idx on public.drawings(owner_token);

alter table public.drawings enable row level security;

drop policy if exists "Public access" on public.drawings;
drop policy if exists "Anyone can create" on public.drawings;
drop policy if exists "Owners can update" on public.drawings;
drop policy if exists "Owners can delete" on public.drawings;

create policy "Public access"
on public.drawings
for select
to anon, authenticated
using (true);

create policy "Anyone can create"
on public.drawings
for insert
to anon, authenticated
with check (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);

create policy "Owners can update"
on public.drawings
for update
to anon, authenticated
using (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
)
with check (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);

create policy "Owners can delete"
on public.drawings
for delete
to anon, authenticated
using (
  owner_token = coalesce(current_setting('request.headers', true)::json->>'x-owner-token', '')
);
