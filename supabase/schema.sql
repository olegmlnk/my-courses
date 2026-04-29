-- Run in Supabase SQL editor. Idempotent — safe to re-run.

-- ============ COURSES & LESSONS ============
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  position int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.lessons add column if not exists completed boolean not null default false;

create index if not exists idx_courses_user on public.courses(user_id);
create index if not exists idx_lessons_course on public.lessons(course_id);
create index if not exists idx_lessons_user on public.lessons(user_id);

alter table public.courses enable row level security;
alter table public.lessons enable row level security;

drop policy if exists "courses_select_own" on public.courses;
create policy "courses_select_own" on public.courses for select using (auth.uid() = user_id);
drop policy if exists "courses_insert_own" on public.courses;
create policy "courses_insert_own" on public.courses for insert with check (auth.uid() = user_id);
drop policy if exists "courses_update_own" on public.courses;
create policy "courses_update_own" on public.courses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_delete_own" on public.courses;
create policy "courses_delete_own" on public.courses for delete using (auth.uid() = user_id);

drop policy if exists "lessons_select_own" on public.lessons;
create policy "lessons_select_own" on public.lessons for select using (auth.uid() = user_id);
drop policy if exists "lessons_insert_own" on public.lessons;
create policy "lessons_insert_own" on public.lessons for insert with check (auth.uid() = user_id);
drop policy if exists "lessons_update_own" on public.lessons;
create policy "lessons_update_own" on public.lessons for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lessons_delete_own" on public.lessons;
create policy "lessons_delete_own" on public.lessons for delete using (auth.uid() = user_id);

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for already-existing users (so older accounts work too)
insert into public.profiles (id, nickname)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ============ SELF-DELETE ACCOUNT ============
create or replace function public.delete_my_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_user() from public;
grant execute on function public.delete_my_user() to authenticated;

-- ============ AVATAR STORAGE BUCKET ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
