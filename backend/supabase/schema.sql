create table if not exists public.users (
  id text not null primary key,
  username text not null unique,
  password_hash text not null,
  recovery_code_hash text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  data_updated_at timestamptz not null default timezone('utc', now()),
  data_reset_at timestamptz,
  data_sync_version bigint not null default 0,
  data_reset_version bigint
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
  lifecycle_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.daily_records (
  user_id text not null,
  record_date date not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 0,
  primary key (user_id, record_date)
);

create table if not exists public.weekly_summaries (
  user_id text not null,
  week_key text not null,
  content text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 0,
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
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text not null default '',
  latest_published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 0,
  primary key (user_id, id)
);

create unique index if not exists uniq_content_sources_user_identity
  on public.content_sources (user_id, channel, type, url, parser_key);

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
  sync_version bigint not null default 0,
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
  sync_version bigint not null default 0,
  primary key (user_id, id),
  unique (user_id, channel, canonical_url)
);

create index if not exists idx_tasks_user_display_order on public.tasks (user_id, display_order);
create index if not exists idx_tasks_user_updated_at on public.tasks (user_id, updated_at desc);
create index if not exists idx_daily_records_user_updated_at on public.daily_records (user_id, updated_at desc);
create index if not exists idx_weekly_summaries_user_updated_at on public.weekly_summaries (user_id, updated_at desc);
create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists idx_user_sessions_expires_at on public.user_sessions (expires_at);
create index if not exists idx_content_sources_user_channel_order on public.content_sources (user_id, channel, sort_order);
create index if not exists idx_content_items_user_channel_published_at on public.content_items (user_id, channel, published_at desc);
create index if not exists idx_content_favorites_user_channel_published_at on public.content_favorites (user_id, channel, published_at desc);

create index if not exists idx_tasks_user_sync_version on public.tasks (user_id, sync_version);
create index if not exists idx_daily_records_user_sync_version on public.daily_records (user_id, sync_version);
create index if not exists idx_weekly_summaries_user_sync_version on public.weekly_summaries (user_id, sync_version);
create index if not exists idx_content_sources_user_sync_version on public.content_sources (user_id, sync_version);
create index if not exists idx_content_items_user_sync_version on public.content_items (user_id, sync_version);
create index if not exists idx_content_favorites_user_sync_version on public.content_favorites (user_id, sync_version);

create or replace function public.assign_lifeflow_sync_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  next_version bigint;
  owner_id text;
begin
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  update public.users
    set data_sync_version = data_sync_version + 1,
        data_updated_at = timezone('utc', now()),
        data_reset_version = case when tg_op = 'DELETE' then data_sync_version + 1 else data_reset_version end,
        data_reset_at = case when tg_op = 'DELETE' then timezone('utc', now()) else data_reset_at end
    where id = owner_id
    returning data_sync_version into next_version;
  if tg_op = 'DELETE' then return old; end if;
  new.sync_version := next_version;
  return new;
end;
$$;

drop trigger if exists tasks_assign_lifeflow_sync_version on public.tasks;
create trigger tasks_assign_lifeflow_sync_version before insert or update or delete on public.tasks
for each row execute function public.assign_lifeflow_sync_version();
drop trigger if exists daily_records_assign_lifeflow_sync_version on public.daily_records;
create trigger daily_records_assign_lifeflow_sync_version before insert or update or delete on public.daily_records
for each row execute function public.assign_lifeflow_sync_version();
drop trigger if exists weekly_summaries_assign_lifeflow_sync_version on public.weekly_summaries;
create trigger weekly_summaries_assign_lifeflow_sync_version before insert or update or delete on public.weekly_summaries
for each row execute function public.assign_lifeflow_sync_version();
drop trigger if exists content_sources_assign_lifeflow_sync_version on public.content_sources;
create trigger content_sources_assign_lifeflow_sync_version before insert or update or delete on public.content_sources
for each row execute function public.assign_lifeflow_sync_version();
drop trigger if exists content_items_assign_lifeflow_sync_version on public.content_items;
create trigger content_items_assign_lifeflow_sync_version before insert or update or delete on public.content_items
for each row execute function public.assign_lifeflow_sync_version();
drop trigger if exists content_favorites_assign_lifeflow_sync_version on public.content_favorites;
create trigger content_favorites_assign_lifeflow_sync_version before insert or update or delete on public.content_favorites
for each row execute function public.assign_lifeflow_sync_version();

create or replace function public.clear_lifeflow_user_data(target_user_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.users set data_sync_version = data_sync_version + 1, data_reset_version = data_sync_version + 1,
    data_updated_at = timezone('utc', now()), data_reset_at = timezone('utc', now())
    where id = target_user_id;
  delete from public.content_favorites where user_id = target_user_id;
  delete from public.content_items where user_id = target_user_id;
  delete from public.content_sources where user_id = target_user_id;
  delete from public.weekly_summaries where user_id = target_user_id;
  delete from public.daily_records where user_id = target_user_id;
  delete from public.tasks where user_id = target_user_id;
end;
$$;

revoke all on function public.clear_lifeflow_user_data(text) from public;
revoke all on function public.clear_lifeflow_user_data(text) from anon;
revoke all on function public.clear_lifeflow_user_data(text) from authenticated;
grant execute on function public.clear_lifeflow_user_data(text) to service_role;

create or replace function public.lifeflow_sync_payload(target_user_id text, lower_version bigint, upper_version bigint)
returns jsonb language sql security invoker set search_path = public as $$
  select jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(x)-'user_id'- 'sync_version' order by x.display_order,x.id) from public.tasks x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'dailyRecords',coalesce((select jsonb_agg(jsonb_build_object('date',x.record_date,'payload',x.payload,'updatedAt',x.updated_at) order by x.record_date) from public.daily_records x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'weeklySummaries',coalesce((select jsonb_agg(jsonb_build_object('week',x.week_key,'content',x.content,'updatedAt',x.updated_at) order by x.week_key) from public.weekly_summaries x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'content',jsonb_build_object('sources',coalesce((select jsonb_agg(to_jsonb(x)-'user_id'- 'sync_version' order by x.sort_order,x.name,x.id) from public.content_sources x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'items',coalesce((select jsonb_agg(to_jsonb(x)-'user_id'- 'sync_version' order by x.updated_at desc,x.id) from public.content_items x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'favorites',coalesce((select jsonb_agg((to_jsonb(x)-'user_id'- 'sync_version') || jsonb_build_object('is_favorite',true) order by x.updated_at desc,x.id) from public.content_favorites x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb)));
$$;
create or replace function public.read_lifeflow_sync_projection(target_user_id text, since_version bigint default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare u public.users%rowtype; upper bigint;
begin select * into u from public.users where id=target_user_id for update; if not found then return jsonb_build_object('data_sync_version',0,'data_reset_version',0,'snapshot',public.lifeflow_sync_payload(target_user_id,-1,0),'changes',public.lifeflow_sync_payload(target_user_id,0,0)); end if; upper:=u.data_sync_version; return jsonb_build_object('data_sync_version',upper,'data_reset_version',coalesce(u.data_reset_version,0),'data_updated_at',u.data_updated_at,'data_reset_at',u.data_reset_at,'snapshot',public.lifeflow_sync_payload(target_user_id,-1,upper),'changes',public.lifeflow_sync_payload(target_user_id,coalesce(since_version,0),upper)); end; $$;
revoke all on function public.read_lifeflow_sync_projection(text,bigint) from public, anon, authenticated;
grant execute on function public.read_lifeflow_sync_projection(text,bigint) to service_role;
revoke all on function public.lifeflow_sync_payload(text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.lifeflow_sync_payload(text,bigint,bigint) to service_role;
