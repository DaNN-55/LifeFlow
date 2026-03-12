alter table public.users
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.content_items
  add column if not exists body_zh text not null default '';

alter table public.content_items
  add column if not exists body_raw text not null default '';
