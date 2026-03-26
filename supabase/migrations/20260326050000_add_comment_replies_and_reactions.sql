-- Add nested comment replies and thumbs up / thumbs down reactions for comments.

alter table public.comments
add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade,
add column if not exists upvote_count integer not null default 0,
add column if not exists downvote_count integer not null default 0;

create index if not exists idx_comments_post_parent_created
on public.comments (post_id, parent_comment_id, created_at desc, id desc);

create index if not exists idx_comments_parent_created
on public.comments (parent_comment_id, created_at asc, id asc);

create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('upvote', 'downvote')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists idx_comment_reactions_comment_id
on public.comment_reactions (comment_id, created_at desc);

create index if not exists idx_comment_reactions_user_id
on public.comment_reactions (user_id, created_at desc);

alter table public.comment_reactions enable row level security;

drop policy if exists "Anyone can view comment reactions" on public.comment_reactions;
create policy "Anyone can view comment reactions"
on public.comment_reactions
for select
using (true);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'comment_likes'
  ) then
    insert into public.comment_reactions (comment_id, user_id, reaction_type, created_at)
    select
      cl.comment_id,
      cl.user_id,
      'upvote',
      cl.created_at
    from public.comment_likes cl
    on conflict (comment_id, user_id) do nothing;
  end if;
end
$$;

create or replace function public.sync_comment_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
    set
      upvote_count = upvote_count + case when new.reaction_type = 'upvote' then 1 else 0 end,
      downvote_count = downvote_count + case when new.reaction_type = 'downvote' then 1 else 0 end
    where id = new.comment_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.comments
    set
      upvote_count = greatest(0, upvote_count - case when old.reaction_type = 'upvote' then 1 else 0 end),
      downvote_count = greatest(0, downvote_count - case when old.reaction_type = 'downvote' then 1 else 0 end)
    where id = old.comment_id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    update public.comments
    set
      upvote_count = greatest(
        0,
        upvote_count
        - case when old.reaction_type = 'upvote' then 1 else 0 end
        + case when new.reaction_type = 'upvote' then 1 else 0 end
      ),
      downvote_count = greatest(
        0,
        downvote_count
        - case when old.reaction_type = 'downvote' then 1 else 0 end
        + case when new.reaction_type = 'downvote' then 1 else 0 end
      )
    where id = new.comment_id;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_comment_reaction_counts_on_comment_reactions on public.comment_reactions;
create trigger sync_comment_reaction_counts_on_comment_reactions
after insert or update or delete on public.comment_reactions
for each row execute function public.sync_comment_reaction_counts();

with reaction_counts as (
  select
    comment_id,
    count(*) filter (where reaction_type = 'upvote')::integer as upvote_count,
    count(*) filter (where reaction_type = 'downvote')::integer as downvote_count
  from public.comment_reactions
  group by comment_id
)
update public.comments c
set
  upvote_count = coalesce(r.upvote_count, 0),
  downvote_count = coalesce(r.downvote_count, 0)
from reaction_counts r
where c.id = r.comment_id;

update public.comments
set
  upvote_count = 0,
  downvote_count = 0
where id not in (select comment_id from public.comment_reactions);

drop function if exists public.create_comment_and_increment(uuid, text);

create or replace function public.create_comment_and_increment(
  p_post_id uuid,
  p_content text,
  p_parent_comment_id uuid
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_parent_comment public.comments;
  v_comment public.comments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_content, '')) = '' then
    raise exception 'Comment content cannot be empty';
  end if;

  if p_parent_comment_id is not null then
    select *
    into v_parent_comment
    from public.comments
    where id = p_parent_comment_id
      and post_id = p_post_id
    limit 1;

    if v_parent_comment.id is null then
      raise exception 'Parent comment not found';
    end if;

  end if;

  v_profile := public.ensure_current_profile();

  insert into public.comments (post_id, parent_comment_id, content, user_id, anonymous_id)
  values (p_post_id, p_parent_comment_id, trim(p_content), auth.uid(), v_profile.anonymous_id)
  returning * into v_comment;

  return v_comment;
end;
$$;

create or replace function public.create_comment_and_increment(
  p_post_id uuid,
  p_content text
)
returns public.comments
language sql
security definer
set search_path = public
as $$
  select public.create_comment_and_increment(p_post_id, p_content, null::uuid);
$$;

create or replace function public.fetch_comments_with_reaction_state(
  p_post_id uuid,
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  post_id uuid,
  parent_comment_id uuid,
  anonymous_id text,
  content text,
  user_id uuid,
  upvote_count integer,
  downvote_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  viewer_reaction text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.post_id,
    c.parent_comment_id,
    c.anonymous_id,
    c.content,
    c.user_id,
    c.upvote_count,
    c.downvote_count,
    c.created_at,
    c.updated_at,
    c.edited_at,
    (
      select cr.reaction_type
      from public.comment_reactions cr
      where cr.comment_id = c.id
        and cr.user_id = auth.uid()
      limit 1
    ) as viewer_reaction
  from public.comments c
  where c.post_id = p_post_id
    and c.parent_comment_id is null
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

create or replace function public.fetch_comment_replies_with_reaction_state(
  p_parent_comment_ids uuid[]
)
returns table (
  id uuid,
  post_id uuid,
  parent_comment_id uuid,
  anonymous_id text,
  content text,
  user_id uuid,
  upvote_count integer,
  downvote_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  viewer_reaction text
)
language sql
security definer
set search_path = public
as $$
  with recursive comment_thread as (
    select
      c.id,
      c.post_id,
      c.parent_comment_id,
      c.anonymous_id,
      c.content,
      c.user_id,
      c.upvote_count,
      c.downvote_count,
      c.created_at,
      c.updated_at,
      c.edited_at
    from public.comments c
    where c.parent_comment_id = any(p_parent_comment_ids)

    union all

    select
      child.id,
      child.post_id,
      child.parent_comment_id,
      child.anonymous_id,
      child.content,
      child.user_id,
      child.upvote_count,
      child.downvote_count,
      child.created_at,
      child.updated_at,
      child.edited_at
    from public.comments child
    join comment_thread thread on child.parent_comment_id = thread.id
  )
  select
    thread.id,
    thread.post_id,
    thread.parent_comment_id,
    thread.anonymous_id,
    thread.content,
    thread.user_id,
    thread.upvote_count,
    thread.downvote_count,
    thread.created_at,
    thread.updated_at,
    thread.edited_at,
    (
      select cr.reaction_type
      from public.comment_reactions cr
      where cr.comment_id = thread.id
        and cr.user_id = auth.uid()
      limit 1
    ) as viewer_reaction
  from comment_thread thread
  order by thread.created_at asc, thread.id asc;
$$;

create or replace function public.set_comment_reaction_state(
  p_comment_id uuid,
  p_reaction_type text default null
)
returns table (
  reaction text,
  upvote_count integer,
  downvote_count integer
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

  if p_reaction_type is not null and p_reaction_type not in ('upvote', 'downvote') then
    raise exception 'Invalid reaction type: %', p_reaction_type;
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
    raise exception 'You cannot react to your own comment';
  end if;

  if p_reaction_type is null then
    delete from public.comment_reactions
    where comment_id = p_comment_id
      and user_id = auth.uid();

    reaction := null;
  else
    insert into public.comment_reactions (comment_id, user_id, reaction_type)
    values (p_comment_id, auth.uid(), p_reaction_type)
    on conflict (comment_id, user_id)
    do update set reaction_type = excluded.reaction_type;

    reaction := p_reaction_type;
  end if;

  select
    c.upvote_count,
    c.downvote_count
  into upvote_count, downvote_count
  from public.comments c
  where c.id = p_comment_id;

  return next;
end;
$$;

revoke all on function public.create_comment_and_increment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.create_comment_and_increment(uuid, text) from public, anon, authenticated;
revoke all on function public.fetch_comments_with_reaction_state(uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.fetch_comment_replies_with_reaction_state(uuid[]) from public, anon, authenticated;
revoke all on function public.set_comment_reaction_state(uuid, text) from public, anon, authenticated;

grant execute on function public.create_comment_and_increment(uuid, text, uuid) to authenticated;
grant execute on function public.create_comment_and_increment(uuid, text) to authenticated;
grant execute on function public.fetch_comments_with_reaction_state(uuid, integer, timestamptz, uuid) to anon, authenticated;
grant execute on function public.fetch_comment_replies_with_reaction_state(uuid[]) to anon, authenticated;
grant execute on function public.set_comment_reaction_state(uuid, text) to authenticated;
