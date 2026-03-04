-- Post reports/moderation queue

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in ('misinformation', 'abuse', 'hate_speech', 'privacy_violation', 'spam', 'other')
  ),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_user_id)
);

create index if not exists idx_post_reports_post_id on public.post_reports(post_id);
create index if not exists idx_post_reports_status_created_at on public.post_reports(status, created_at desc);

alter table public.post_reports enable row level security;

drop policy if exists "Users can insert their own post reports" on public.post_reports;
create policy "Users can insert their own post reports"
on public.post_reports
for insert
to authenticated
with check (auth.uid() = reporter_user_id);

drop policy if exists "Users can view their own post reports" on public.post_reports;
create policy "Users can view their own post reports"
on public.post_reports
for select
to authenticated
using (auth.uid() = reporter_user_id);
