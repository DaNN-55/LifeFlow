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

create index if not exists idx_content_sources_user_channel_order
  on public.content_sources (user_id, channel, sort_order);

create index if not exists idx_content_items_user_channel_published_at
  on public.content_items (user_id, channel, published_at desc);
