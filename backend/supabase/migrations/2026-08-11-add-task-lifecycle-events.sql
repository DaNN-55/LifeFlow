alter table public.tasks
  add column if not exists lifecycle_events jsonb not null default '[]'::jsonb;
