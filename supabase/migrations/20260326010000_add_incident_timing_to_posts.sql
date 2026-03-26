-- Store the reported incident timing separately from the submission timestamp.

alter table public.posts
add column if not exists incident_date date,
add column if not exists incident_time time without time zone;

create index if not exists idx_posts_incident_date
on public.posts (incident_date desc);
