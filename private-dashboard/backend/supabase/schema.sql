create table if not exists public.users (
  id text not null primary key,
  username text not null unique,
  password_hash text not null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_sessions (
  id text not null primary key,
  user_id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  user_id text not null,
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
  user_id text not null,
  record_date date not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, record_date)
);

create table if not exists public.weekly_summaries (
  user_id text not null,
  week_key text not null,
  content text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, week_key)
);

create table if not exists public.content_sources (
  user_id text not null references public.users(id) on delete cascade,
  id text not null,
  channel text not null,
  type text not null,
  name text not null,
  url text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  parser_key text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.content_items (
  user_id text not null references public.users(id) on delete cascade,
  id text not null,
  channel text not null,
  source_id text not null,
  title text not null,
  summary_zh text not null default '',
  summary_raw text not null default '',
  body_zh text not null default '',
  body_raw text not null default '',
  author text not null default '',
  published_at timestamptz not null default timezone('utc', now()),
  content_type text not null default '',
  source_name text not null default '',
  source_url text not null default '',
  canonical_url text not null,
  tags jsonb not null default '[]'::jsonb,
  lang text not null default '',
  image_url text not null default '',
  is_featured boolean not null default false,
  fetched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  unique (user_id, channel, canonical_url)
);

create table if not exists public.content_favorites (
  user_id text not null references public.users(id) on delete cascade,
  id text not null,
  channel text not null,
  source_id text not null default '',
  title text not null,
  summary_zh text not null default '',
  summary_raw text not null default '',
  body_zh text not null default '',
  body_raw text not null default '',
  author text not null default '',
  published_at timestamptz not null default timezone('utc', now()),
  content_type text not null default '',
  source_name text not null default '',
  source_url text not null default '',
  canonical_url text not null,
  tags jsonb not null default '[]'::jsonb,
  lang text not null default '',
  image_url text not null default '',
  favorited_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  unique (user_id, channel, canonical_url)
);

create index if not exists idx_tasks_user_display_order on public.tasks (user_id, display_order);
create index if not exists idx_daily_records_user_updated_at on public.daily_records (user_id, updated_at desc);
create index if not exists idx_weekly_summaries_user_updated_at on public.weekly_summaries (user_id, updated_at desc);
create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists idx_user_sessions_expires_at on public.user_sessions (expires_at);
create index if not exists idx_content_sources_user_channel_order on public.content_sources (user_id, channel, sort_order);
create index if not exists idx_content_items_user_channel_published_at on public.content_items (user_id, channel, published_at desc);
create index if not exists idx_content_favorites_user_channel_published_at on public.content_favorites (user_id, channel, published_at desc);
