create table if not exists public.users (
  id text not null primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_sessions (
  id text not null primary key,
  user_id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists idx_user_sessions_expires_at on public.user_sessions (expires_at);
