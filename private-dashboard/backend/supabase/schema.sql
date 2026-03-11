create table if not exists public.users (
  id text not null primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_sessions (
  id text not null primary key,
  user_id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  user_id text not null default 'public',
  id text not null,
  name text not null,
  color text not null,
  display_order integer not null default 0,
  archived boolean not null default false,
  archived_at timestamptz,
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

create table if not exists public.weekly_summaries (
  user_id text not null default 'public',
  week_key text not null,
  content text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, week_key)
);

create index if not exists idx_tasks_user_display_order on public.tasks (user_id, display_order);
create index if not exists idx_daily_records_user_updated_at on public.daily_records (user_id, updated_at desc);
create index if not exists idx_weekly_summaries_user_updated_at on public.weekly_summaries (user_id, updated_at desc);
create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists idx_user_sessions_expires_at on public.user_sessions (expires_at);
