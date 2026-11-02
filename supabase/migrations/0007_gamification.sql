create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_key)
);

alter table public.user_achievements enable row level security;
drop policy if exists "users read own achievements" on public.user_achievements;
create policy "users read own achievements" on public.user_achievements for select using (auth.uid() = user_id);
drop policy if exists "users create own achievements" on public.user_achievements;
create policy "users create own achievements" on public.user_achievements for insert with check (auth.uid() = user_id);
