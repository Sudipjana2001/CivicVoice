-- Allow replies on replies and fetch full nested comment threads.

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

revoke all on function public.create_comment_and_increment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.fetch_comment_replies_with_reaction_state(uuid[]) from public, anon, authenticated;

grant execute on function public.create_comment_and_increment(uuid, text, uuid) to authenticated;
grant execute on function public.fetch_comment_replies_with_reaction_state(uuid[]) to anon, authenticated;
