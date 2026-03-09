create table if not exists public.tasks (
  id text primary key,
  name text not null,
  color text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_records (
  record_date date primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tasks_display_order on public.tasks (display_order);
create index if not exists idx_daily_records_updated_at on public.daily_records (updated_at desc);
