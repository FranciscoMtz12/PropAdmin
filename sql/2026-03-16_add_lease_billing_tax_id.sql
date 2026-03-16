alter table public.leases
add column if not exists billing_tax_id text;

create index if not exists idx_leases_billing_tax_id
on public.leases (billing_tax_id);
