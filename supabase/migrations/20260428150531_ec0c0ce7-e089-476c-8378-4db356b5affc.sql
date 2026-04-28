
insert into storage.buckets (id, name, public)
values ('trade-charts', 'trade-charts', true)
on conflict (id) do nothing;

create policy "trade-charts public read"
on storage.objects for select
using (bucket_id = 'trade-charts');

create policy "trade-charts auth insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'trade-charts');

create policy "trade-charts auth update"
on storage.objects for update
to authenticated
using (bucket_id = 'trade-charts');

create policy "trade-charts auth delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'trade-charts');
