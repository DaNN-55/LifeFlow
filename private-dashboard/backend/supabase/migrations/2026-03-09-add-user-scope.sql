alter table public.tasks add column if not exists user_id text;
update public.tasks set user_id = 'public' where user_id is null;
alter table public.tasks alter column user_id set default 'public';
alter table public.tasks alter column user_id set not null;

alter table public.daily_records add column if not exists user_id text;
update public.daily_records set user_id = 'public' where user_id is null;
alter table public.daily_records alter column user_id set default 'public';
alter table public.daily_records alter column user_id set not null;

alter table public.tasks drop constraint if exists tasks_pkey;
alter table public.tasks add constraint tasks_pkey primary key (user_id, id);

alter table public.daily_records drop constraint if exists daily_records_pkey;
alter table public.daily_records add constraint daily_records_pkey primary key (user_id, record_date);

drop index if exists idx_tasks_display_order;
drop index if exists idx_daily_records_updated_at;

create index if not exists idx_tasks_user_display_order on public.tasks (user_id, display_order);
create index if not exists idx_daily_records_user_updated_at on public.daily_records (user_id, updated_at desc);
