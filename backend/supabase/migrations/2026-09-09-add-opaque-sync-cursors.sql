alter table public.users
  add column if not exists data_sync_version bigint not null default 0,
  add column if not exists data_reset_version bigint;

alter table public.tasks add column if not exists sync_version bigint not null default 0;
alter table public.daily_records add column if not exists sync_version bigint not null default 0;
alter table public.weekly_summaries add column if not exists sync_version bigint not null default 0;
alter table public.content_sources add column if not exists sync_version bigint not null default 0;
alter table public.content_items add column if not exists sync_version bigint not null default 0;
alter table public.content_favorites add column if not exists sync_version bigint not null default 0;

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
        data_reset_version = case
          when tg_op = 'DELETE' then data_sync_version + 1
          else data_reset_version
        end,
        data_reset_at = case
          when tg_op = 'DELETE' then timezone('utc', now())
          else data_reset_at
        end
    where id = owner_id
    returning data_sync_version into next_version;

  if tg_op = 'DELETE' then
    return old;
  end if;

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
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(to_jsonb(x)-'user_id'- 'sync_version' order by x.display_order,x.id) from public.tasks x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),
    'dailyRecords', coalesce((select jsonb_agg(jsonb_build_object('date',x.record_date,'payload',x.payload,'updatedAt',x.updated_at) order by x.record_date) from public.daily_records x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),
    'weeklySummaries', coalesce((select jsonb_agg(jsonb_build_object('week',x.week_key,'content',x.content,'updatedAt',x.updated_at) order by x.week_key) from public.weekly_summaries x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),
    'content', jsonb_build_object('sources',coalesce((select jsonb_agg(to_jsonb(x)-'user_id'- 'sync_version' order by x.sort_order,x.name,x.id) from public.content_sources x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'items',coalesce((select jsonb_agg(to_jsonb(x)-'user_id'- 'sync_version' order by x.updated_at desc,x.id) from public.content_items x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb),'favorites',coalesce((select jsonb_agg((to_jsonb(x)-'user_id'- 'sync_version') || jsonb_build_object('is_favorite',true) order by x.updated_at desc,x.id) from public.content_favorites x where x.user_id=target_user_id and x.sync_version>lower_version and x.sync_version<=upper_version),'[]'::jsonb))
  );
$$;
create or replace function public.read_lifeflow_sync_projection(target_user_id text, since_version bigint default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare u public.users%rowtype; upper bigint;
begin
  select * into u from public.users where id = target_user_id for update;
  if not found then return jsonb_build_object('data_sync_version',0,'data_reset_version',0,'snapshot',public.lifeflow_sync_payload(target_user_id,-1,0),'changes',public.lifeflow_sync_payload(target_user_id,0,0)); end if;
  upper := u.data_sync_version;
  return jsonb_build_object('data_sync_version',upper,'data_reset_version',coalesce(u.data_reset_version,0),'data_updated_at',u.data_updated_at,'data_reset_at',u.data_reset_at,'snapshot',public.lifeflow_sync_payload(target_user_id,-1,upper),'changes',public.lifeflow_sync_payload(target_user_id,coalesce(since_version,0),upper));
end; $$;
revoke all on function public.lifeflow_sync_payload(text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.lifeflow_sync_payload(text,bigint,bigint) to service_role;
revoke all on function public.read_lifeflow_sync_projection(text,bigint) from public, anon, authenticated;
grant execute on function public.read_lifeflow_sync_projection(text,bigint) to service_role;
