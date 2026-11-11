-- Our Little Garden: private Supabase setup
-- Run this in Supabase SQL Editor. Keep the Storage bucket PRIVATE.
create table if not exists public.garden_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 70),
  story text not null default '' check (char_length(story) <= 500),
  memory_date date,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.garden_members enable row level security;
alter table public.memories enable row level security;
create or replace function public.is_garden_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.garden_members where user_id = auth.uid()); $$;
revoke all on function public.is_garden_member() from public;
grant execute on function public.is_garden_member() to authenticated;
drop policy if exists "Members can read their membership" on public.garden_members;
create policy "Members can read their membership" on public.garden_members
for select to authenticated using (user_id = auth.uid());
drop policy if exists "Garden members can read memories" on public.memories;
create policy "Garden members can read memories" on public.memories
for select to authenticated using (public.is_garden_member());
drop policy if exists "Garden members can add memories" on public.memories;
create policy "Garden members can add memories" on public.memories
for insert to authenticated with check (public.is_garden_member() and user_id = auth.uid());
drop policy if exists "Garden members can update memories" on public.memories;
create policy "Garden members can update memories" on public.memories
for update to authenticated using (public.is_garden_member() and user_id = auth.uid()) with check (public.is_garden_member() and user_id = auth.uid());
drop policy if exists "Garden members can delete memories" on public.memories;
create policy "Garden members can delete memories" on public.memories
for delete to authenticated using (public.is_garden_member() and user_id = auth.uid());

-- Create a PRIVATE Storage bucket named "memories" in Dashboard > Storage.
-- Storage policies: only the two allowlisted members can upload/read/remove objects.
drop policy if exists "Garden members read memory photos" on storage.objects;
create policy "Garden members read memory photos" on storage.objects
for select to authenticated using (bucket_id = 'memories' and public.is_garden_member());
drop policy if exists "Garden members upload memory photos" on storage.objects;
create policy "Garden members upload memory photos" on storage.objects
for insert to authenticated with check (bucket_id = 'memories' and public.is_garden_member() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Garden members delete own memory photos" on storage.objects;
create policy "Garden members delete own memory photos" on storage.objects
for delete to authenticated using (bucket_id = 'memories' and public.is_garden_member() and (storage.foldername(name))[1] = auth.uid()::text);

-- Invite each of the two email addresses from Authentication > Users > Invite user.
-- After both users accept their invites and set passwords, run these two statements
-- with their exact auth.users IDs and email addresses:
-- insert into public.garden_members(user_id,email) values ('USER_UUID_1','first@example.com');
-- insert into public.garden_members(user_id,email) values ('USER_UUID_2','second@example.com');
-- Do not enable public sign-ups. Do not expose service_role keys in frontend code.
