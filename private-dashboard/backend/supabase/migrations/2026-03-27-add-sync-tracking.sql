alter table public.users add column if not exists data_updated_at timestamptz not null default timezone('utc', now());
alter table public.users add column if not exists data_reset_at timestamptz;

alter table public.tasks add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_tasks_user_updated_at on public.tasks (user_id, updated_at desc);
