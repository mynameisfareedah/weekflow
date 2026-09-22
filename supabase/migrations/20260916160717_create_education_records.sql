do $$
declare
  expected_column record;
begin
  if to_regclass('public.education_records') is not null then
    if (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'education_records'
    ) <> 5
    or exists (
      select 1
      from (values
        ('workspace_id', 'uuid'),
        ('week_start', 'date'),
        ('data', 'jsonb'),
        ('created_at', 'timestamptz'),
        ('updated_at', 'timestamptz')
      ) as expected(column_name, udt_name)
      where not exists (
        select 1
        from information_schema.columns actual
        where actual.table_schema = 'public'
          and actual.table_name = 'education_records'
          and actual.column_name = expected.column_name
          and actual.udt_name = expected.udt_name
          and actual.is_nullable = 'NO'
      )
    ) then
      raise exception 'public.education_records exists with an incompatible column structure';
    end if;

    if not exists (
      select 1
      from pg_constraint constraint_row
      where constraint_row.conrelid = 'public.education_records'::regclass
        and constraint_row.contype = 'p'
        and constraint_row.conkey = array[
          (select attribute.attnum from pg_attribute attribute where attribute.attrelid = 'public.education_records'::regclass and attribute.attname = 'workspace_id'),
          (select attribute.attnum from pg_attribute attribute where attribute.attrelid = 'public.education_records'::regclass and attribute.attname = 'week_start')
        ]::smallint[]
    ) then
      raise exception 'public.education_records exists without the expected primary key';
    end if;

    if not exists (
      select 1
      from pg_constraint constraint_row
      where constraint_row.conrelid = 'public.education_records'::regclass
        and constraint_row.contype = 'f'
        and constraint_row.confrelid = 'public.workspace_weeks'::regclass
        and constraint_row.conkey = array[
          (select attribute.attnum from pg_attribute attribute where attribute.attrelid = 'public.education_records'::regclass and attribute.attname = 'workspace_id'),
          (select attribute.attnum from pg_attribute attribute where attribute.attrelid = 'public.education_records'::regclass and attribute.attname = 'week_start')
        ]::smallint[]
        and constraint_row.confkey = array[
          (select attribute.attnum from pg_attribute attribute where attribute.attrelid = 'public.workspace_weeks'::regclass and attribute.attname = 'workspace_id'),
          (select attribute.attnum from pg_attribute attribute where attribute.attrelid = 'public.workspace_weeks'::regclass and attribute.attname = 'week_start')
        ]::smallint[]
    ) then
      raise exception 'public.education_records exists without the expected workspace/week foreign key';
    end if;
  else
    create table public.education_records (
      workspace_id uuid not null,
      week_start date not null,
      data jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now()),
      primary key (workspace_id, week_start),
      foreign key (workspace_id, week_start)
        references public.workspace_weeks(workspace_id, week_start)
        on delete cascade
    );
  end if;
end
$$;

alter table public.education_records enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'education_records'
      and policyname = 'users manage own education records'
  ) then
    create policy "users manage own education records"
    on public.education_records
    for all
    using (
      exists (
        select 1
        from public.workspaces
        where id = workspace_id
          and owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.workspaces
        where id = workspace_id
          and owner_id = auth.uid()
      )
    );
  end if;
end
$$;
