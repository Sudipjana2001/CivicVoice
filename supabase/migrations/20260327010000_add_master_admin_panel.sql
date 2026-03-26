-- Add master admin support and guarded moderation RPCs.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('master_admin', 'moderator')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_admin_users_role
on public.admin_users (role);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can view admin users" on public.admin_users;
create policy "Admins can view admin users"
on public.admin_users
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users current_admin
    where current_admin.user_id = auth.uid()
  )
);

revoke all on table public.admin_users from anon, authenticated;

create or replace function public.get_admin_role(
  p_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_user_id is null then
    return null;
  end if;

  select role
  into v_role
  from public.admin_users
  where user_id = p_user_id
  limit 1;

  return v_role;
end;
$$;

create or replace function public.is_admin_user(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.get_admin_role(p_user_id) is not null;
$$;

create or replace function public.require_admin_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_role := public.get_admin_role(auth.uid());

  if v_role is null then
    raise exception 'Admin access required';
  end if;

  return v_role;
end;
$$;

create or replace function public.require_master_admin_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.require_admin_role() <> 'master_admin' then
    raise exception 'Master admin access required';
  end if;
end;
$$;

create or replace function public.get_my_admin_access()
returns table (
  user_id uuid,
  role text,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  v_role := public.get_admin_role(v_user_id);

  return query
  select
    v_user_id,
    v_role,
    v_role is not null;
end;
$$;

create or replace function public.admin_get_dashboard_summary()
returns table (
  total_posts integer,
  open_reports integer,
  reviewing_reports integer,
  total_comments integer,
  total_users integer,
  active_admins integer,
  under_review_posts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_role();

  return query
  select
    (select count(*)::integer from public.posts),
    (select count(*)::integer from public.post_reports where status = 'open'),
    (select count(*)::integer from public.post_reports where status = 'reviewing'),
    (select count(*)::integer from public.comments),
    (select count(*)::integer from public.profiles where user_id is not null),
    (select count(*)::integer from public.admin_users),
    (select count(*)::integer from public.posts where status = 'under_review');
end;
$$;

create or replace function public.admin_list_posts(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  anonymous_id text,
  content text,
  category text,
  severity text,
  location text,
  status text,
  created_at timestamptz,
  credible_votes integer,
  suspicious_votes integer,
  comment_count integer,
  report_count integer,
  user_id uuid,
  incident_date date,
  incident_time time without time zone,
  evidence_type text,
  self_destruct_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.require_admin_role();

  if p_status is not null
     and p_status not in ('submitted', 'under_review', 'escalated', 'action_noted', 'resolved', 'closed') then
    raise exception 'Invalid post status: %', p_status;
  end if;

  return query
  select
    p.id,
    p.anonymous_id,
    p.content,
    p.category,
    p.severity,
    p.location,
    p.status,
    p.created_at,
    p.credible_votes,
    p.suspicious_votes,
    p.comment_count,
    p.report_count,
    p.user_id,
    p.incident_date,
    p.incident_time,
    p.evidence_type,
    p.self_destruct_at
  from public.posts p
  where (p_status is null or p.status = p_status)
    and (
      v_search is null
      or p.anonymous_id ilike '%' || v_search || '%'
      or p.content ilike '%' || v_search || '%'
      or coalesce(p.location, '') ilike '%' || v_search || '%'
      or coalesce(p.category, '') ilike '%' || v_search || '%'
    )
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

create or replace function public.admin_set_post_status(
  p_post_id uuid,
  p_status text
)
returns table (
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts;
begin
  perform public.require_admin_role();

  if p_status not in ('submitted', 'under_review', 'escalated', 'action_noted', 'resolved', 'closed') then
    raise exception 'Invalid post status: %', p_status;
  end if;

  update public.posts
  set status = p_status
  where public.posts.id = p_post_id
  returning * into v_post;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  return query
  select v_post.id, v_post.status;
end;
$$;

create or replace function public.admin_delete_post(
  p_post_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  perform public.require_admin_role();

  delete from public.posts
  where id = p_post_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Post not found';
  end if;

  return v_deleted_id;
end;
$$;

create or replace function public.admin_list_post_reports(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  post_id uuid,
  reporter_user_id uuid,
  reporter_anonymous_id text,
  post_anonymous_id text,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  post_status text,
  post_excerpt text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.require_admin_role();

  if p_status is not null
     and p_status not in ('open', 'reviewing', 'closed', 'dismissed') then
    raise exception 'Invalid report status: %', p_status;
  end if;

  return query
  select
    pr.id,
    pr.post_id,
    pr.reporter_user_id,
    reporter_profile.anonymous_id,
    p.anonymous_id,
    pr.reason,
    pr.details,
    pr.status,
    pr.created_at,
    p.status,
    left(p.content, 160)
  from public.post_reports pr
  join public.posts p on p.id = pr.post_id
  left join public.profiles reporter_profile on reporter_profile.user_id = pr.reporter_user_id
  where (p_status is null or pr.status = p_status)
    and (
      v_search is null
      or pr.reason ilike '%' || v_search || '%'
      or coalesce(pr.details, '') ilike '%' || v_search || '%'
      or p.anonymous_id ilike '%' || v_search || '%'
      or p.content ilike '%' || v_search || '%'
      or coalesce(reporter_profile.anonymous_id, '') ilike '%' || v_search || '%'
    )
  order by pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

create or replace function public.admin_set_post_report_status(
  p_report_id uuid,
  p_status text
)
returns table (
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.post_reports;
begin
  perform public.require_admin_role();

  if p_status not in ('open', 'reviewing', 'closed', 'dismissed') then
    raise exception 'Invalid report status: %', p_status;
  end if;

  update public.post_reports
  set status = p_status
  where public.post_reports.id = p_report_id
  returning * into v_report;

  if v_report.id is null then
    raise exception 'Report not found';
  end if;

  return query
  select v_report.id, v_report.status;
end;
$$;

create or replace function public.admin_list_comments(
  p_search text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  post_id uuid,
  parent_comment_id uuid,
  anonymous_id text,
  content text,
  user_id uuid,
  created_at timestamptz,
  edited_at timestamptz,
  upvote_count integer,
  downvote_count integer,
  post_anonymous_id text,
  post_excerpt text,
  direct_reply_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.require_admin_role();

  return query
  select
    c.id,
    c.post_id,
    c.parent_comment_id,
    c.anonymous_id,
    c.content,
    c.user_id,
    c.created_at,
    c.edited_at,
    c.upvote_count,
    c.downvote_count,
    p.anonymous_id,
    left(p.content, 140),
    (
      select count(*)::integer
      from public.comments child
      where child.parent_comment_id = c.id
    ) as direct_reply_count
  from public.comments c
  join public.posts p on p.id = c.post_id
  where (
      v_search is null
      or c.anonymous_id ilike '%' || v_search || '%'
      or c.content ilike '%' || v_search || '%'
      or p.anonymous_id ilike '%' || v_search || '%'
      or p.content ilike '%' || v_search || '%'
    )
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.admin_delete_comment(
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
  perform public.require_admin_role();

  delete from public.comments
  where id = p_comment_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Comment not found';
  end if;

  return v_deleted_id;
end;
$$;

create or replace function public.admin_list_profiles(
  p_search text default null,
  p_limit integer default 100
)
returns table (
  user_id uuid,
  profile_id uuid,
  anonymous_id text,
  credibility_score integer,
  credibility_level text,
  reports_count integer,
  inbox_enabled boolean,
  self_destruct_days integer,
  created_at timestamptz,
  updated_at timestamptz,
  post_count integer,
  comment_count integer,
  report_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.require_admin_role();

  return query
  select
    p.user_id,
    p.id,
    p.anonymous_id,
    p.credibility_score,
    p.credibility_level,
    p.reports_count,
    p.inbox_enabled,
    p.self_destruct_days,
    p.created_at,
    p.updated_at,
    (
      select count(*)::integer
      from public.posts post_row
      where post_row.user_id = p.user_id
    ) as post_count,
    (
      select count(*)::integer
      from public.comments comment_row
      where comment_row.user_id = p.user_id
    ) as comment_count,
    (
      select count(*)::integer
      from public.post_reports report_row
      where report_row.reporter_user_id = p.user_id
    ) as report_count
  from public.profiles p
  where p.user_id is not null
    and (
      v_search is null
      or p.anonymous_id ilike '%' || v_search || '%'
      or p.user_id::text ilike '%' || v_search || '%'
    )
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.admin_send_inbox_message(
  p_recipient_user_id uuid,
  p_subject text,
  p_content text,
  p_sender_label text default 'CivicVoice Moderation',
  p_related_post_id uuid default null
)
returns public.inbox_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_message public.inbox_messages;
  v_subject text := trim(coalesce(p_subject, ''));
  v_content text := trim(coalesce(p_content, ''));
  v_sender_label text := nullif(trim(coalesce(p_sender_label, '')), '');
begin
  perform public.require_admin_role();

  if p_recipient_user_id is null then
    raise exception 'Recipient user is required';
  end if;

  if v_subject = '' then
    raise exception 'Subject cannot be empty';
  end if;

  if v_content = '' then
    raise exception 'Message cannot be empty';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = p_recipient_user_id
  limit 1;

  if v_profile.id is null then
    raise exception 'Recipient profile not found';
  end if;

  insert into public.inbox_messages (
    recipient_anonymous_id,
    recipient_user_id,
    sender_type,
    sender_label,
    subject,
    preview,
    content,
    related_post_id
  )
  values (
    v_profile.anonymous_id,
    p_recipient_user_id,
    'moderator',
    coalesce(v_sender_label, 'CivicVoice Moderation'),
    v_subject,
    left(regexp_replace(v_content, '\s+', ' ', 'g'), 120),
    v_content,
    p_related_post_id
  )
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.admin_list_admin_users()
returns table (
  user_id uuid,
  role text,
  created_at timestamptz,
  created_by uuid,
  anonymous_id text,
  created_by_anonymous_id text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_role();

  return query
  select
    admin.user_id,
    admin.role,
    admin.created_at,
    admin.created_by,
    target_profile.anonymous_id,
    creator_profile.anonymous_id
  from public.admin_users admin
  left join public.profiles target_profile on target_profile.user_id = admin.user_id
  left join public.profiles creator_profile on creator_profile.user_id = admin.created_by
  order by
    case admin.role when 'master_admin' then 0 else 1 end,
    admin.created_at asc;
end;
$$;

create or replace function public.admin_upsert_admin_user(
  p_target_user_id uuid,
  p_role text
)
returns public.admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.admin_users;
begin
  perform public.require_master_admin_role();

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if p_role not in ('master_admin', 'moderator') then
    raise exception 'Invalid admin role: %', p_role;
  end if;

  insert into public.admin_users as admin_users (user_id, role, created_by)
  values (p_target_user_id, p_role, auth.uid())
  on conflict (user_id)
  do update
  set
    role = excluded.role,
    created_by = excluded.created_by
  returning * into v_admin;

  return v_admin;
end;
$$;

create or replace function public.admin_remove_admin_user(
  p_target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  perform public.require_master_admin_role();

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot remove your own admin access';
  end if;

  delete from public.admin_users
  where user_id = p_target_user_id
  returning user_id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Admin user not found';
  end if;

  return v_deleted_id;
end;
$$;

revoke all on function public.get_admin_role(uuid) from public, anon, authenticated;
revoke all on function public.is_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.require_admin_role() from public, anon, authenticated;
revoke all on function public.require_master_admin_role() from public, anon, authenticated;
revoke all on function public.get_my_admin_access() from public, anon, authenticated;
revoke all on function public.admin_get_dashboard_summary() from public, anon, authenticated;
revoke all on function public.admin_list_posts(text, text, integer) from public, anon, authenticated;
revoke all on function public.admin_set_post_status(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_delete_post(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_post_reports(text, text, integer) from public, anon, authenticated;
revoke all on function public.admin_set_post_report_status(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_list_comments(text, integer) from public, anon, authenticated;
revoke all on function public.admin_delete_comment(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_profiles(text, integer) from public, anon, authenticated;
revoke all on function public.admin_send_inbox_message(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_list_admin_users() from public, anon, authenticated;
revoke all on function public.admin_upsert_admin_user(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_remove_admin_user(uuid) from public, anon, authenticated;

grant execute on function public.get_my_admin_access() to authenticated;
grant execute on function public.admin_get_dashboard_summary() to authenticated;
grant execute on function public.admin_list_posts(text, text, integer) to authenticated;
grant execute on function public.admin_set_post_status(uuid, text) to authenticated;
grant execute on function public.admin_delete_post(uuid) to authenticated;
grant execute on function public.admin_list_post_reports(text, text, integer) to authenticated;
grant execute on function public.admin_set_post_report_status(uuid, text) to authenticated;
grant execute on function public.admin_list_comments(text, integer) to authenticated;
grant execute on function public.admin_delete_comment(uuid) to authenticated;
grant execute on function public.admin_list_profiles(text, integer) to authenticated;
grant execute on function public.admin_send_inbox_message(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.admin_list_admin_users() to authenticated;
grant execute on function public.admin_upsert_admin_user(uuid, text) to authenticated;
grant execute on function public.admin_remove_admin_user(uuid) to authenticated;
