alter table if exists public.users
  add column if not exists recovery_code_hash text not null default '';
