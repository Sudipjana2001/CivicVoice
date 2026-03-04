-- Ensure evidence storage bucket and policies exist

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can upload evidence" on storage.objects;
create policy "Authenticated users can upload evidence"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'evidence');

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
