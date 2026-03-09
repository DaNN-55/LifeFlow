create table if not exists public.tasks (
  user_id text not null default 'public',
  id text not null,
  name text not null,
  color text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.daily_records (
  user_id text not null default 'public',
  record_date date not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, record_date)
);

create index if not exists idx_tasks_user_display_order on public.tasks (user_id, display_order);
create index if not exists idx_daily_records_user_updated_at on public.daily_records (user_id, updated_at desc);
