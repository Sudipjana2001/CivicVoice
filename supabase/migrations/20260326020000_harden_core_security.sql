-- Harden core security and ownership rules.
-- This migration moves sensitive writes to authenticated, server-backed flows.

-- Collapse accidental duplicate profiles before enforcing one profile per auth user.
do $$
begin
  if exists (
    select 1
    from public.profiles
    where user_id is not null
    group by user_id
    having count(*) > 1
  ) then
    create temporary table tmp_profile_keep on commit drop as
    select distinct on (user_id)
      user_id,
      id as keep_id
    from public.profiles
    where user_id is not null
    order by user_id, created_at asc, id asc;

    create temporary table tmp_profile_dupes on commit drop as
    select
      p.user_id,
      p.id as duplicate_id,
      k.keep_id
    from public.profiles p
    join tmp_profile_keep k using (user_id)
    where p.user_id is not null
      and p.id <> k.keep_id;

    update public.profiles keep
    set
      reports_count = merged.reports_count,
      credibility_score = merged.credibility_score,
      credibility_level = merged.credibility_level,
      inbox_enabled = merged.inbox_enabled,
      self_destruct_days = merged.self_destruct_days,
      updated_at = greatest(keep.updated_at, merged.updated_at)
    from (
      select
        k.keep_id,
        sum(p.reports_count)::integer as reports_count,
        max(p.credibility_score)::integer as credibility_score,
        case max(
          case p.credibility_level
            when 'none' then 0
            when 'new' then 1
            when 'trusted' then 2
            when 'veteran' then 3
            else 1
          end
        )
          when 0 then 'none'
          when 1 then 'new'
          when 2 then 'trusted'
          else 'veteran'
        end as credibility_level,
        bool_or(p.inbox_enabled) as inbox_enabled,
        min(p.self_destruct_days) filter (where p.self_destruct_days is not null) as self_destruct_days,
        max(p.updated_at) as updated_at
      from public.profiles p
      join tmp_profile_keep k using (user_id)
      group by k.keep_id
    ) merged
    where keep.id = merged.keep_id;

    insert into public.followed_topics (profile_id, topic_type, topic_value, topic_label, created_at)
    select
      d.keep_id,
      ft.topic_type,
      ft.topic_value,
      ft.topic_label,
      ft.created_at
    from public.followed_topics ft
    join tmp_profile_dupes d on d.duplicate_id = ft.profile_id
    on conflict (profile_id, topic_type, topic_value)
    do update
    set topic_label = excluded.topic_label;

    insert into public.alert_preferences (
      profile_id,
      new_incidents,
      status_updates,
      weekly_digest,
      created_at,
      updated_at
    )
    select
      d.keep_id,
      ap.new_incidents,
      ap.status_updates,
      ap.weekly_digest,
      ap.created_at,
      ap.updated_at
    from public.alert_preferences ap
    join tmp_profile_dupes d on d.duplicate_id = ap.profile_id
    on conflict (profile_id)
    do update
    set
      new_incidents = public.alert_preferences.new_incidents or excluded.new_incidents,
      status_updates = public.alert_preferences.status_updates or excluded.status_updates,
      weekly_digest = public.alert_preferences.weekly_digest or excluded.weekly_digest,
      updated_at = greatest(public.alert_preferences.updated_at, excluded.updated_at);

    update public.activity_history ah
    set profile_id = d.keep_id
    from tmp_profile_dupes d
    where ah.profile_id = d.duplicate_id;

    delete from public.followed_topics ft
    using tmp_profile_dupes d
    where ft.profile_id = d.duplicate_id;

    delete from public.alert_preferences ap
    using tmp_profile_dupes d
    where ap.profile_id = d.duplicate_id;

    delete from public.profiles p
    using tmp_profile_dupes d
    where p.id = d.duplicate_id;
  end if;
end
$$;

-- Ensure each auth user has at most one profile row.
create unique index if not exists idx_profiles_user_id_unique
on public.profiles (user_id)
where user_id is not null;

-- Comments now track the owning authenticated user.
alter table public.comments
add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_comments_user_id
on public.comments (user_id);

-- Votes must belong to authenticated users. Legacy anonymous votes are removed.
alter table public.votes
add column if not exists voter_user_id uuid references auth.users(id) on delete cascade;

delete from public.votes
where voter_user_id is null;

alter table public.votes
drop constraint if exists votes_post_id_voter_id_key;

drop index if exists idx_votes_voter_id;

alter table public.votes
drop column if exists voter_id;

create unique index if not exists idx_votes_post_id_voter_user_id
on public.votes (post_id, voter_user_id);

create index if not exists idx_votes_voter_user_id
on public.votes (voter_user_id);

alter table public.votes
alter column voter_user_id set not null;

with vote_counts as (
  select
    post_id,
    count(*) filter (where vote_type = 'credible')::integer as credible_votes,
    count(*) filter (where vote_type = 'suspicious')::integer as suspicious_votes
  from public.votes
  group by post_id
)
update public.posts p
set
  credible_votes = coalesce(v.vote_credible_votes, 0),
  suspicious_votes = coalesce(v.vote_suspicious_votes, 0)
from (
  select
    post_id,
    credible_votes as vote_credible_votes,
    suspicious_votes as vote_suspicious_votes
  from vote_counts
) v
where p.id = v.post_id;

update public.posts
set credible_votes = 0,
    suspicious_votes = 0
where id not in (select post_id from public.votes);

-- Inbox messages and alerts are owned directly by authenticated users now.
alter table public.inbox_messages
add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;

alter table public.alerts
add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_inbox_messages_recipient_user_id
on public.inbox_messages (recipient_user_id, created_at desc);

create index if not exists idx_alerts_recipient_user_id
on public.alerts (recipient_user_id, created_at desc);

with resolved_recipients as (
  select
    anonymous_id,
    (array_agg(distinct user_id))[1] as user_id
  from public.posts
  where user_id is not null
  group by anonymous_id
  having count(distinct user_id) = 1
)
update public.inbox_messages m
set recipient_user_id = r.user_id
from resolved_recipients r
where m.recipient_user_id is null
  and m.recipient_anonymous_id = r.anonymous_id;

with resolved_recipients as (
  select
    anonymous_id,
    (array_agg(distinct user_id))[1] as user_id
  from public.posts
  where user_id is not null
  group by anonymous_id
  having count(distinct user_id) = 1
)
update public.alerts a
set recipient_user_id = r.user_id
from resolved_recipients r
where a.recipient_user_id is null
  and a.recipient_anonymous_id = r.anonymous_id;

delete from public.inbox_messages
where recipient_user_id is null;

delete from public.alerts
where recipient_user_id is null;

alter table public.inbox_messages
alter column recipient_user_id set not null;

alter table public.alerts
alter column recipient_user_id set not null;

-- Evidence is now private-by-default.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can upload evidence" on storage.objects;
create policy "Authenticated users can upload evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'evidence'
  and owner = auth.uid()
);

drop policy if exists "Authenticated users can update their evidence" on storage.objects;
create policy "Authenticated users can update their evidence"
on storage.objects
for update
to authenticated
using (bucket_id = 'evidence' and owner = auth.uid())
with check (bucket_id = 'evidence' and owner = auth.uid());

drop policy if exists "Authenticated users can delete their evidence" on storage.objects;
create policy "Authenticated users can delete their evidence"
on storage.objects
for delete
to authenticated
using (bucket_id = 'evidence' and owner = auth.uid());

drop policy if exists "Authenticated users can view their evidence" on storage.objects;
create policy "Authenticated users can view their evidence"
on storage.objects
for select
to authenticated
using (bucket_id = 'evidence');

-- Restrict broad direct writes to authenticated, server-backed flows.
drop policy if exists "Anyone can create posts" on public.posts;
drop policy if exists "Anyone can update posts" on public.posts;
drop policy if exists "Users can update their own posts" on public.posts;
drop policy if exists "Anyone can insert comments" on public.comments;
drop policy if exists "Anyone can insert votes" on public.votes;
drop policy if exists "Anyone can update votes" on public.votes;
drop policy if exists "Anyone can delete votes" on public.votes;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own post reports" on public.post_reports;

drop policy if exists "Anyone can view their inbox messages" on public.inbox_messages;
drop policy if exists "Anyone can update inbox messages" on public.inbox_messages;
drop policy if exists "Anyone can delete inbox messages" on public.inbox_messages;
drop policy if exists "Users can view their inbox messages" on public.inbox_messages;
drop policy if exists "Users can update their inbox messages" on public.inbox_messages;
drop policy if exists "Users can delete their inbox messages" on public.inbox_messages;

create policy "Users can view their inbox messages"
on public.inbox_messages
for select
using (recipient_user_id = auth.uid());

create policy "Users can update their inbox messages"
on public.inbox_messages
for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

create policy "Users can delete their inbox messages"
on public.inbox_messages
for delete
using (recipient_user_id = auth.uid());

drop policy if exists "Anyone can view alerts" on public.alerts;
drop policy if exists "Anyone can update alerts" on public.alerts;
drop policy if exists "Anyone can delete alerts" on public.alerts;
drop policy if exists "Users can view their alerts" on public.alerts;
drop policy if exists "Users can update their alerts" on public.alerts;
drop policy if exists "Users can delete their alerts" on public.alerts;

create policy "Users can view their alerts"
on public.alerts
for select
using (recipient_user_id = auth.uid());

create policy "Users can update their alerts"
on public.alerts
for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

create policy "Users can delete their alerts"
on public.alerts
for delete
using (recipient_user_id = auth.uid());

drop function if exists public.get_user_vote(uuid, text);
drop function if exists public.toggle_vote_and_update_counts(uuid, text, text);

create or replace function public.ensure_current_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if v_profile.id is null then
    insert into public.profiles (user_id)
    values (auth.uid())
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

create or replace function public.create_post(
  p_content text,
  p_category text,
  p_severity text,
  p_evidence_type text default null,
  p_location text default null,
  p_incident_date date default null,
  p_incident_time time without time zone default null,
  p_image_path text default null,
  p_self_destruct_days integer default null
)
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_post public.posts;
  v_self_destruct_days integer;
  v_self_destruct_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_content, '')) = '' then
    raise exception 'Post content cannot be empty';
  end if;

  v_profile := public.ensure_current_profile();
  v_self_destruct_days := coalesce(p_self_destruct_days, v_profile.self_destruct_days);

  if v_self_destruct_days is not null and v_self_destruct_days not in (7, 30, 90) then
    raise exception 'Invalid self-destruct setting: %', v_self_destruct_days;
  end if;

  if v_self_destruct_days is not null then
    v_self_destruct_at := now() + make_interval(days => v_self_destruct_days);
  else
    v_self_destruct_at := null;
  end if;

  insert into public.posts (
    user_id,
    anonymous_id,
    content,
    category,
    severity,
    evidence_type,
    location,
    incident_date,
    incident_time,
    image_url,
    self_destruct_at
  )
  values (
    auth.uid(),
    v_profile.anonymous_id,
    trim(p_content),
    p_category,
    p_severity,
    nullif(trim(coalesce(p_evidence_type, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    p_incident_date,
    p_incident_time,
    nullif(trim(coalesce(p_image_path, '')), ''),
    v_self_destruct_at
  )
  returning * into v_post;

  update public.profiles
  set reports_count = reports_count + 1
  where id = v_profile.id;

  insert into public.activity_history (profile_id, activity_type, description, related_post_id)
  values (v_profile.id, 'report_submitted', 'Submitted a new report', v_post.id);

  return v_post;
end;
$$;

create or replace function public.update_own_post(
  p_post_id uuid,
  p_content text default null,
  p_category text default null,
  p_severity text default null,
  p_location text default null
)
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.posts
  set
    content = coalesce(nullif(trim(coalesce(p_content, '')), ''), content),
    category = coalesce(p_category, category),
    severity = coalesce(p_severity, severity),
    location = case
      when p_location is null then location
      when trim(p_location) = '' then null
      else trim(p_location)
    end
  where id = p_post_id
    and user_id = auth.uid()
  returning * into v_post;

  if v_post.id is null then
    raise exception 'Post not found or not owned by current user';
  end if;

  return v_post;
end;
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

  update public.posts
  set comment_count = comment_count + 1
  where id = p_post_id;

  return v_comment;
end;
$$;

create or replace function public.get_user_vote(
  p_post_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select vote_type
  into v_vote
  from public.votes
  where post_id = p_post_id
    and voter_user_id = auth.uid()
  limit 1;

  return v_vote;
end;
$$;

create or replace function public.toggle_vote_and_update_counts(
  p_post_id uuid,
  p_vote_type text
)
returns table (
  new_vote text,
  credible_votes integer,
  suspicious_votes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_vote text;
  v_credible integer;
  v_suspicious integer;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_vote_type not in ('credible', 'suspicious') then
    raise exception 'Invalid vote type: %', p_vote_type;
  end if;

  select p.credible_votes, p.suspicious_votes
  into v_credible, v_suspicious
  from public.posts p
  where p.id = p_post_id
  for update;

  if v_credible is null and v_suspicious is null then
    raise exception 'Post not found: %', p_post_id;
  end if;

  select vote_type
  into v_current_vote
  from public.votes
  where post_id = p_post_id
    and voter_user_id = auth.uid()
  limit 1;

  if v_current_vote = p_vote_type then
    delete from public.votes
    where post_id = p_post_id
      and voter_user_id = auth.uid();

    if p_vote_type = 'credible' then
      v_credible := greatest(0, v_credible - 1);
    else
      v_suspicious := greatest(0, v_suspicious - 1);
    end if;

    new_vote := null;
  else
    insert into public.votes (post_id, voter_user_id, vote_type)
    values (p_post_id, auth.uid(), p_vote_type)
    on conflict (post_id, voter_user_id)
    do update set vote_type = excluded.vote_type;

    if v_current_vote = 'credible' then
      v_credible := greatest(0, v_credible - 1);
    elsif v_current_vote = 'suspicious' then
      v_suspicious := greatest(0, v_suspicious - 1);
    end if;

    if p_vote_type = 'credible' then
      v_credible := v_credible + 1;
    else
      v_suspicious := v_suspicious + 1;
    end if;

    new_vote := p_vote_type;
  end if;

  update public.posts
  set credible_votes = v_credible,
      suspicious_votes = v_suspicious
  where id = p_post_id;

  v_profile := public.ensure_current_profile();

  if new_vote is not null then
    insert into public.activity_history (profile_id, activity_type, description, related_post_id)
    values (v_profile.id, 'vote_cast', 'Voted on a report', p_post_id);
  end if;

  credible_votes := v_credible;
  suspicious_votes := v_suspicious;
  return next;
end;
$$;

create or replace function public.submit_post_report(
  p_post_id uuid,
  p_reason text,
  p_details text default null
)
returns public.post_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.post_reports;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.post_reports (post_id, reporter_user_id, reason, details)
  values (
    p_post_id,
    auth.uid(),
    p_reason,
    nullif(trim(coalesce(p_details, '')), '')
  )
  returning * into v_report;

  return v_report;
end;
$$;

create or replace function public.update_profile_preferences(
  p_inbox_enabled boolean,
  p_self_destruct_days integer
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_self_destruct_days is not null and p_self_destruct_days not in (7, 30, 90) then
    raise exception 'Invalid self-destruct setting: %', p_self_destruct_days;
  end if;

  v_profile := public.ensure_current_profile();

  update public.profiles
  set
    inbox_enabled = p_inbox_enabled,
    self_destruct_days = p_self_destruct_days
  where id = v_profile.id
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.wipe_old_user_data(
  p_cutoff timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_posts integer := 0;
  v_comments integer := 0;
  v_votes integer := 0;
  v_reports integer := 0;
  v_messages integer := 0;
  v_alerts integer := 0;
  v_activity integer := 0;
  v_comment_post_ids uuid[] := '{}';
  v_vote_post_ids uuid[] := '{}';
  v_report_post_ids uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  with deleted_posts as (
    delete from public.posts
    where user_id = auth.uid()
      and created_at < p_cutoff
    returning id
  )
  select count(*)::integer
  into v_posts
  from deleted_posts;

  with deleted_comments as (
    delete from public.comments
    where user_id = auth.uid()
      and created_at < p_cutoff
    returning id, post_id
  )
  select
    count(*)::integer,
    coalesce(array_agg(distinct post_id), '{}')
  into v_comments, v_comment_post_ids
  from deleted_comments;

  with deleted_votes as (
    delete from public.votes
    where voter_user_id = auth.uid()
      and created_at < p_cutoff
    returning id, post_id
  )
  select
    count(*)::integer,
    coalesce(array_agg(distinct post_id), '{}')
  into v_votes, v_vote_post_ids
  from deleted_votes;

  with deleted_reports as (
    delete from public.post_reports
    where reporter_user_id = auth.uid()
      and created_at < p_cutoff
    returning id, post_id
  )
  select
    count(*)::integer,
    coalesce(array_agg(distinct post_id), '{}')
  into v_reports, v_report_post_ids
  from deleted_reports;

  with deleted_messages as (
    delete from public.inbox_messages
    where recipient_user_id = auth.uid()
      and created_at < p_cutoff
    returning id
  )
  select count(*)::integer
  into v_messages
  from deleted_messages;

  with deleted_alerts as (
    delete from public.alerts
    where recipient_user_id = auth.uid()
      and created_at < p_cutoff
    returning id
  )
  select count(*)::integer
  into v_alerts
  from deleted_alerts;

  if v_profile.id is not null then
    with deleted_activity as (
      delete from public.activity_history
      where profile_id = v_profile.id
        and created_at < p_cutoff
      returning id
    )
    select count(*)::integer
    into v_activity
    from deleted_activity;
  end if;

  if coalesce(array_length(v_comment_post_ids, 1), 0) > 0 then
    update public.posts p
    set comment_count = coalesce(c.comment_count, 0)
    from (
      select post_id, count(*)::integer as comment_count
      from public.comments
      where post_id = any(v_comment_post_ids)
      group by post_id
    ) c
    where p.id = c.post_id;

    update public.posts
    set comment_count = 0
    where id = any(v_comment_post_ids)
      and id not in (
        select post_id
        from public.comments
        where post_id = any(v_comment_post_ids)
      );
  end if;

  if coalesce(array_length(v_vote_post_ids, 1), 0) > 0 then
    update public.posts p
    set
      credible_votes = coalesce(v.credible_votes, 0),
      suspicious_votes = coalesce(v.suspicious_votes, 0)
    from (
      select
        post_id,
        count(*) filter (where vote_type = 'credible')::integer as credible_votes,
        count(*) filter (where vote_type = 'suspicious')::integer as suspicious_votes
      from public.votes
      where post_id = any(v_vote_post_ids)
      group by post_id
    ) v
    where p.id = v.post_id;

    update public.posts
    set credible_votes = 0,
        suspicious_votes = 0
    where id = any(v_vote_post_ids)
      and id not in (
        select post_id
        from public.votes
        where post_id = any(v_vote_post_ids)
      );
  end if;

  if coalesce(array_length(v_report_post_ids, 1), 0) > 0 then
    update public.posts p
    set report_count = coalesce(r.report_count, 0)
    from (
      select post_id, count(*)::integer as report_count
      from public.post_reports
      where post_id = any(v_report_post_ids)
      group by post_id
    ) r
    where p.id = r.post_id;

    update public.posts
    set report_count = 0
    where id = any(v_report_post_ids)
      and id not in (
        select post_id
        from public.post_reports
        where post_id = any(v_report_post_ids)
      );
  end if;

  return jsonb_build_object(
    'posts', v_posts,
    'comments', v_comments,
    'votes', v_votes,
    'postReports', v_reports,
    'messages', v_messages,
    'alerts', v_alerts,
    'activity', v_activity
  );
end;
$$;

revoke all on function public.ensure_current_profile() from public, anon, authenticated;
revoke all on function public.create_post(text, text, text, text, text, date, time without time zone, text, integer) from public, anon, authenticated;
revoke all on function public.update_own_post(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_comment_and_increment(uuid, text) from public, anon, authenticated;
revoke all on function public.get_user_vote(uuid) from public, anon, authenticated;
revoke all on function public.toggle_vote_and_update_counts(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_post_report(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_profile_preferences(boolean, integer) from public, anon, authenticated;
revoke all on function public.wipe_old_user_data(timestamptz) from public, anon, authenticated;
grant execute on function public.create_post(text, text, text, text, text, date, time without time zone, text, integer) to authenticated;
grant execute on function public.update_own_post(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_comment_and_increment(uuid, text) to authenticated;
grant execute on function public.get_user_vote(uuid) to authenticated;
grant execute on function public.toggle_vote_and_update_counts(uuid, text) to authenticated;
grant execute on function public.submit_post_report(uuid, text, text) to authenticated;
grant execute on function public.update_profile_preferences(boolean, integer) to authenticated;
grant execute on function public.wipe_old_user_data(timestamptz) to authenticated;
