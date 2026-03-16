
-- Create storage bucket for payment proofs
insert into storage.buckets (id, name, public)
values ('payment-proofs','payment-proofs',false)
on conflict (id) do nothing;

-- Allow authenticated users to upload
create policy "payment proofs insert"
on storage.objects
for insert
to authenticated
with check (bucket_id='payment-proofs');

create policy "payment proofs select"
on storage.objects
for select
to authenticated
using (bucket_id='payment-proofs');
