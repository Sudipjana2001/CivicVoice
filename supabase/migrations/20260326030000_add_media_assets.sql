-- Add media metadata and delivery manifest support for faster evidence rendering.

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'document', 'other')),
  original_path text not null,
  thumb_path text,
  card_path text,
  full_path text,
  poster_path text,
  preview_path text,
  width integer,
  height integer,
  duration_ms integer,
  mime_type text,
  lqip_data_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_assets_post_id
on public.media_assets (post_id);

alter table public.media_assets enable row level security;

drop policy if exists "Authenticated users can view media assets" on public.media_assets;
create policy "Authenticated users can view media assets"
on public.media_assets
for select
to authenticated
using (true);

drop policy if exists "Users can manage media assets for their posts" on public.media_assets;
create policy "Users can manage media assets for their posts"
on public.media_assets
for all
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = media_assets.post_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.posts p
    where p.id = media_assets.post_id
      and p.user_id = auth.uid()
  )
);

insert into public.media_assets (
  post_id,
  kind,
  original_path,
  full_path,
  mime_type
)
select
  p.id,
  case p.evidence_type
    when 'photo' then 'image'
    when 'video' then 'video'
    when 'document' then 'document'
    else 'other'
  end,
  p.image_url,
  p.image_url,
  null
from public.posts p
where p.image_url is not null
  and not exists (
    select 1
    from public.media_assets m
    where m.post_id = p.id
  );

create or replace function public.upsert_post_media_asset(
  p_post_id uuid,
  p_kind text,
  p_original_path text,
  p_thumb_path text default null,
  p_card_path text default null,
  p_full_path text default null,
  p_poster_path text default null,
  p_preview_path text default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null,
  p_mime_type text default null,
  p_lqip_data_url text default null
)
returns public.media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.media_assets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_kind not in ('image', 'video', 'document', 'other') then
    raise exception 'Invalid media kind: %', p_kind;
  end if;

  if trim(coalesce(p_original_path, '')) = '' then
    raise exception 'Original media path is required';
  end if;

  if not exists (
    select 1
    from public.posts
    where id = p_post_id
      and user_id = auth.uid()
  ) then
    raise exception 'Post not found or not owned by current user';
  end if;

  insert into public.media_assets (
    post_id,
    kind,
    original_path,
    thumb_path,
    card_path,
    full_path,
    poster_path,
    preview_path,
    width,
    height,
    duration_ms,
    mime_type,
    lqip_data_url,
    updated_at
  )
  values (
    p_post_id,
    p_kind,
    trim(p_original_path),
    nullif(trim(coalesce(p_thumb_path, '')), ''),
    nullif(trim(coalesce(p_card_path, '')), ''),
    nullif(trim(coalesce(p_full_path, '')), ''),
    nullif(trim(coalesce(p_poster_path, '')), ''),
    nullif(trim(coalesce(p_preview_path, '')), ''),
    p_width,
    p_height,
    p_duration_ms,
    nullif(trim(coalesce(p_mime_type, '')), ''),
    nullif(p_lqip_data_url, ''),
    now()
  )
  on conflict (post_id)
  do update
  set
    kind = excluded.kind,
    original_path = excluded.original_path,
    thumb_path = excluded.thumb_path,
    card_path = excluded.card_path,
    full_path = excluded.full_path,
    poster_path = excluded.poster_path,
    preview_path = excluded.preview_path,
    width = excluded.width,
    height = excluded.height,
    duration_ms = excluded.duration_ms,
    mime_type = excluded.mime_type,
    lqip_data_url = excluded.lqip_data_url,
    updated_at = now()
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.upsert_post_media_asset(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.upsert_post_media_asset(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text
) to authenticated;
