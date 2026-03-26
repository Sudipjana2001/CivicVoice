-- Add comment likes, comment management RPCs, and counter synchronization.

alter table public.comments
add column if not exists like_count integer not null default 0,
add column if not exists updated_at timestamptz not null default now(),
add column if not exists edited_at timestamptz;

create index if not exists idx_comments_post_created_id
on public.comments (post_id, created_at desc, id desc);

create index if not exists idx_comments_like_count
on public.comments (like_count desc, created_at desc);

drop trigger if exists update_comments_updated_at on public.comments;
create trigger update_comments_updated_at
before update on public.comments
for each row execute function public.update_updated_at_column();

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists idx_comment_likes_comment_id
on public.comment_likes (comment_id, created_at desc);

create index if not exists idx_comment_likes_user_id
on public.comment_likes (user_id, created_at desc);

alter table public.comment_likes enable row level security;

drop policy if exists "Anyone can view comment likes" on public.comment_likes;
create policy "Anyone can view comment likes"
on public.comment_likes
for select
using (true);

create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comment_count = comment_count + 1
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.posts
    set comment_count = greatest(0, comment_count - 1)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_post_comment_count_on_comments on public.comments;
create trigger sync_post_comment_count_on_comments
after insert or delete on public.comments
for each row execute function public.sync_post_comment_count();

create or replace function public.sync_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
    set like_count = like_count + 1
    where id = new.comment_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.comments
    set like_count = greatest(0, like_count - 1)
    where id = old.comment_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_comment_like_count_on_comment_likes on public.comment_likes;
create trigger sync_comment_like_count_on_comment_likes
after insert or delete on public.comment_likes
for each row execute function public.sync_comment_like_count();

with comment_counts as (
  select
    post_id,
    count(*)::integer as comment_count
  from public.comments
  group by post_id
)
update public.posts p
set comment_count = coalesce(c.comment_count, 0)
from comment_counts c
where p.id = c.post_id;

update public.posts
set comment_count = 0
where id not in (select post_id from public.comments);

with like_counts as (
  select
    comment_id,
    count(*)::integer as like_count
  from public.comment_likes
  group by comment_id
)
update public.comments c
set like_count = coalesce(l.like_count, 0)
from like_counts l
where c.id = l.comment_id;

update public.comments
set like_count = 0
where id not in (select comment_id from public.comment_likes);

create or replace function public.fetch_comments_with_like_state(
  p_post_id uuid,
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  post_id uuid,
  anonymous_id text,
  content text,
  user_id uuid,
  like_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  viewer_has_liked boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.post_id,
    c.anonymous_id,
    c.content,
    c.user_id,
    c.like_count,
    c.created_at,
    c.updated_at,
    c.edited_at,
    exists (
      select 1
      from public.comment_likes cl
      where cl.comment_id = c.id
        and cl.user_id = auth.uid()
    ) as viewer_has_liked
  from public.comments c
  where c.post_id = p_post_id
    and (
      p_before_created_at is null
      or c.created_at < p_before_created_at
      or (
        p_before_id is not null
        and c.created_at = p_before_created_at
        and c.id < p_before_id
      )
    )
  order by c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.create_comment_and_increment(
  p_post_id uuid,
  p_content text
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_comment public.comments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_content, '')) = '' then
    raise exception 'Comment content cannot be empty';
  end if;

  v_profile := public.ensure_current_profile();

  insert into public.comments (post_id, content, user_id, anonymous_id)
  values (p_post_id, trim(p_content), auth.uid(), v_profile.anonymous_id)
  returning * into v_comment;

  return v_comment;
end;
$$;

create or replace function public.update_own_comment(
  p_comment_id uuid,
  p_content text
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.comments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_content, '')) = '' then
    raise exception 'Comment content cannot be empty';
  end if;

  update public.comments
  set
    content = trim(p_content),
    edited_at = now(),
    updated_at = now()
  where id = p_comment_id
    and user_id = auth.uid()
  returning * into v_comment;

  if v_comment.id is null then
    raise exception 'Comment not found or not owned by current user';
  end if;

  return v_comment;
end;
$$;

create or replace function public.delete_own_comment_and_decrement(
  p_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.comments
  where id = p_comment_id
    and user_id = auth.uid()
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Comment not found or not owned by current user';
  end if;

  return v_deleted_id;
end;
$$;

create or replace function public.set_comment_like_state(
  p_comment_id uuid,
  p_like boolean
)
returns table (
  liked boolean,
  like_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.comments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_comment
  from public.comments
  where id = p_comment_id
  limit 1;

  if v_comment.id is null then
    raise exception 'Comment not found';
  end if;

  if v_comment.user_id = auth.uid() then
    raise exception 'You cannot like your own comment';
  end if;

  if p_like then
    insert into public.comment_likes (comment_id, user_id)
    values (p_comment_id, auth.uid())
    on conflict (comment_id, user_id) do nothing;
    liked := true;
  else
    delete from public.comment_likes
    where comment_id = p_comment_id
      and user_id = auth.uid();
    liked := false;
  end if;

  select c.like_count
  into like_count
  from public.comments c
  where c.id = p_comment_id;

  return next;
end;
$$;

revoke all on function public.fetch_comments_with_like_state(uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.create_comment_and_increment(uuid, text) from public, anon, authenticated;
revoke all on function public.update_own_comment(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_own_comment_and_decrement(uuid) from public, anon, authenticated;
revoke all on function public.set_comment_like_state(uuid, boolean) from public, anon, authenticated;

grant execute on function public.fetch_comments_with_like_state(uuid, integer, timestamptz, uuid) to anon, authenticated;
grant execute on function public.create_comment_and_increment(uuid, text) to authenticated;
grant execute on function public.update_own_comment(uuid, text) to authenticated;
grant execute on function public.delete_own_comment_and_decrement(uuid) to authenticated;
grant execute on function public.set_comment_like_state(uuid, boolean) to authenticated;
