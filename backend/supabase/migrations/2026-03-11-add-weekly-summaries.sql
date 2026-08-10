create table if not exists public.weekly_summaries (
  user_id text not null default 'public',
  week_key text not null,
  content text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, week_key)
);

create index if not exists idx_weekly_summaries_user_updated_at
  on public.weekly_summaries (user_id, updated_at desc);
