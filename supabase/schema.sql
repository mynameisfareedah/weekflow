create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'displayName', ''), coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email, updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  template_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived boolean not null default false
);

create table if not exists public.workspace_weeks (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, week_start)
);

create table if not exists public.weekly_plans (
  workspace_id uuid not null,
  week_start date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, week_start),
  foreign key (workspace_id, week_start) references public.workspace_weeks(workspace_id, week_start) on delete cascade
);

create table if not exists public.daily_activities (
  workspace_id uuid not null,
  week_start date not null,
  data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, week_start),
  foreign key (workspace_id, week_start) references public.workspace_weeks(workspace_id, week_start) on delete cascade
);

create table if not exists public.follow_ups (
  workspace_id uuid not null,
  week_start date not null,
  data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, week_start),
  foreign key (workspace_id, week_start) references public.workspace_weeks(workspace_id, week_start) on delete cascade
);

create table if not exists public.smart_start (
  workspace_id uuid not null,
  week_start date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, week_start),
  foreign key (workspace_id, week_start) references public.workspace_weeks(workspace_id, week_start) on delete cascade
);

create table if not exists public.report_history (
  workspace_id uuid not null,
  week_start date not null,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, week_start),
  foreign key (workspace_id, week_start) references public.workspace_weeks(workspace_id, week_start) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_weeks enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.daily_activities enable row level security;
alter table public.follow_ups enable row level security;
alter table public.smart_start enable row level security;
alter table public.report_history enable row level security;

create policy "users manage own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "users manage own workspaces" on public.workspaces for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users manage own workspace weeks" on public.workspace_weeks for all using (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())) with check (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));
create policy "users manage own weekly plans" on public.weekly_plans for all using (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())) with check (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));
create policy "users manage own daily activities" on public.daily_activities for all using (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())) with check (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));
create policy "users manage own follow ups" on public.follow_ups for all using (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())) with check (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));
create policy "users manage own smart start" on public.smart_start for all using (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())) with check (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));
create policy "users manage own report history" on public.report_history for all using (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())) with check (exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));