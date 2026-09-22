alter table public.workspaces
  add column if not exists report_metadata jsonb;
