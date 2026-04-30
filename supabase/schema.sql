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

-- ============ FRIENDS & SHARING (Phase 2) ============

-- 1. Course visibility
alter table public.courses
  add column if not exists visibility text not null default 'private'
  check (visibility in ('private', 'friends', 'public'));
create index if not exists idx_courses_visibility on public.courses(visibility);

-- 2. Unique nickname (handle-style). Existing duplicates need manual cleanup before this passes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_nickname_unique') then
    alter table public.profiles add constraint profiles_nickname_unique unique (nickname);
  end if;
end$$;

-- 3. Friendships
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_involved" on public.friendships;
create policy "friendships_select_involved" on public.friendships for select using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);
drop policy if exists "friendships_insert_self" on public.friendships;
create policy "friendships_insert_self" on public.friendships for insert with check (
  auth.uid() = requester_id
);
drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee" on public.friendships for update using (
  auth.uid() = addressee_id
) with check (auth.uid() = addressee_id);
drop policy if exists "friendships_delete_involved" on public.friendships;
create policy "friendships_delete_involved" on public.friendships for delete using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- Helper: is this user a friend of mine (accepted)?
create or replace function public.is_friend(other_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = other_id) or
        (f.addressee_id = auth.uid() and f.requester_id = other_id)
      )
  );
$$;
grant execute on function public.is_friend(uuid) to authenticated;

-- 4. Per-user lesson progress
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists idx_lesson_progress_lesson on public.lesson_progress(lesson_id);

alter table public.lesson_progress enable row level security;

drop policy if exists "lp_select_own" on public.lesson_progress;
create policy "lp_select_own" on public.lesson_progress for select using (auth.uid() = user_id);
drop policy if exists "lp_insert_own" on public.lesson_progress;
create policy "lp_insert_own" on public.lesson_progress for insert with check (auth.uid() = user_id);
drop policy if exists "lp_update_own" on public.lesson_progress;
create policy "lp_update_own" on public.lesson_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lp_delete_own" on public.lesson_progress;
create policy "lp_delete_own" on public.lesson_progress for delete using (auth.uid() = user_id);

-- One-time backfill: migrate old lessons.completed (owner-only) into lesson_progress
insert into public.lesson_progress (user_id, lesson_id, completed)
select l.user_id, l.id, true
from public.lessons l
where l.completed = true
on conflict (user_id, lesson_id) do nothing;

-- 5. Relax profiles SELECT — any authenticated user can read id/nickname/avatar_url for search
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

-- 6. Expand courses SELECT: own + public + friends-of-owner
drop policy if exists "courses_select_own" on public.courses;
drop policy if exists "courses_select_visible" on public.courses;
create policy "courses_select_visible" on public.courses for select using (
  auth.uid() = user_id
  or visibility = 'public'
  or (visibility = 'friends' and public.is_friend(user_id))
);

-- 7. Expand lessons SELECT: own + lessons of any visible course
drop policy if exists "lessons_select_own" on public.lessons;
drop policy if exists "lessons_select_visible" on public.lessons;
create policy "lessons_select_visible" on public.lessons for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.courses c
    where c.id = lessons.course_id
      and (
        c.visibility = 'public'
        or (c.visibility = 'friends' and public.is_friend(c.user_id))
      )
  )
);

-- 8. User search RPC (auto-detects email vs nickname by '@')
create or replace function public.search_users(q text)
returns table (id uuid, nickname text, avatar_url text, matched_by text)
language plpgsql stable security definer set search_path = public, auth
as $$
declare
  norm text := trim(q);
begin
  if norm is null or length(norm) < 2 then
    return;
  end if;

  if position('@' in norm) > 0 then
    return query
    select p.id, p.nickname, p.avatar_url, 'email'::text
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.email ilike '%' || norm || '%'
      and u.id <> auth.uid()
    limit 20;
  else
    return query
    select p.id, p.nickname, p.avatar_url, 'nickname'::text
    from public.profiles p
    where p.nickname ilike '%' || norm || '%'
      and p.id <> auth.uid()
    limit 20;
  end if;
end;
$$;

revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;

-- ============ STREAKS (Phase 3) ============
create or replace function public.get_my_streak()
returns table (current_streak integer, longest_streak integer, today_count integer)
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  rec record;
  prev_d date;
  cur_run int := 0;
  best int := 0;
  today_d date := current_date;
  yesterday_d date := current_date - 1;
  effective_current int := 0;
  today_n int := 0;
begin
  if me is null then
    current_streak := 0; longest_streak := 0; today_count := 0;
    return next;
    return;
  end if;

  for rec in
    select distinct (completed_at)::date as d
    from public.lesson_progress
    where user_id = me and completed = true
    order by d
  loop
    if prev_d is null then
      cur_run := 1;
    elsif rec.d = prev_d + 1 then
      cur_run := cur_run + 1;
    else
      cur_run := 1;
    end if;
    if cur_run > best then best := cur_run; end if;
    prev_d := rec.d;
  end loop;

  if prev_d = today_d or prev_d = yesterday_d then
    effective_current := cur_run;
  end if;

  select count(*)::int into today_n
  from public.lesson_progress
  where user_id = me and completed = true
    and (completed_at)::date = today_d;

  current_streak := effective_current;
  longest_streak := best;
  today_count := today_n;
  return next;
end;
$$;

revoke all on function public.get_my_streak() from public;
grant execute on function public.get_my_streak() to authenticated;

-- ============ VIDEO BOOKMARKS (Phase 3) ============
create table if not exists public.lesson_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  timestamp_seconds int not null check (timestamp_seconds >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_bookmarks_user_lesson on public.lesson_bookmarks(user_id, lesson_id);

alter table public.lesson_bookmarks enable row level security;

drop policy if exists "bookmarks_select_own" on public.lesson_bookmarks;
create policy "bookmarks_select_own" on public.lesson_bookmarks for select using (auth.uid() = user_id);
drop policy if exists "bookmarks_insert_own" on public.lesson_bookmarks;
create policy "bookmarks_insert_own" on public.lesson_bookmarks for insert with check (auth.uid() = user_id);
drop policy if exists "bookmarks_update_own" on public.lesson_bookmarks;
create policy "bookmarks_update_own" on public.lesson_bookmarks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bookmarks_delete_own" on public.lesson_bookmarks;
create policy "bookmarks_delete_own" on public.lesson_bookmarks for delete using (auth.uid() = user_id);
