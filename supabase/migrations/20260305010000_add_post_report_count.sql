-- Track total report count per post

alter table public.posts
add column if not exists report_count integer not null default 0;

-- Backfill counts from existing reports
update public.posts p
set report_count = coalesce(r.cnt, 0)
from (
  select post_id, count(*)::integer as cnt
  from public.post_reports
  group by post_id
) r
where p.id = r.post_id;

update public.posts
set report_count = 0
where report_count is null;

create or replace function public.increment_post_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set report_count = report_count + 1
  where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists trigger_increment_post_report_count on public.post_reports;
create trigger trigger_increment_post_report_count
after insert on public.post_reports
for each row
execute function public.increment_post_report_count();
