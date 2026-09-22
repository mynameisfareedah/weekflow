create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text not null,
  message text not null,
  source text not null default 'support' check (source in ('support', 'contact')),
  status text not null default 'open' check (status = 'open'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.support_requests
  add column if not exists source text not null default 'support';

alter table public.support_requests
  drop constraint if exists support_requests_source_check;

alter table public.support_requests
  add constraint support_requests_source_check check (source in ('support', 'contact'));

alter table public.support_requests enable row level security;

drop policy if exists "anyone can submit support requests" on public.support_requests;
create policy "anyone can submit support requests"
on public.support_requests
for insert
to anon, authenticated
with check (status = 'open');
