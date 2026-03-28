-- Count only top-level comments in posts.comment_count so replies remain separate.

create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_comment_id is null then
      update public.posts
      set comment_count = comment_count + 1
      where id = new.post_id;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.parent_comment_id is null then
      update public.posts
      set comment_count = greatest(0, comment_count - 1)
      where id = old.post_id;
    end if;

    return old;
  end if;

  return null;
end;
$$;

with top_level_comment_counts as (
  select
    post_id,
    count(*)::integer as comment_count
  from public.comments
  where parent_comment_id is null
  group by post_id
)
update public.posts p
set comment_count = coalesce(c.comment_count, 0)
from top_level_comment_counts c
where p.id = c.post_id;

update public.posts
set comment_count = 0
where id not in (
  select post_id
  from public.comments
  where parent_comment_id is null
);
