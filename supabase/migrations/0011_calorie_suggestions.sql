create table if not exists public.calorie_adjustment_suggestions (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_day date not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  suggestion jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_day)
);

alter table public.calorie_adjustment_suggestions enable row level security;
drop policy if exists "read own calorie suggestions" on public.calorie_adjustment_suggestions;
create policy "read own calorie suggestions" on public.calorie_adjustment_suggestions
  for select using (auth.uid() = user_id);

create or replace function public.delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.food_entries where user_id = auth.uid()::text;
  delete from public.weight_entries where user_id = auth.uid()::text;
  delete from public.user_preferences where user_id = auth.uid()::text;
  delete from public.workout_sessions where user_id = auth.uid()::text;
  delete from public.daily_activity where user_id = auth.uid()::text;
  delete from public.user_achievements where user_id = auth.uid();
  delete from public.calorie_adjustment_suggestions where user_id = auth.uid();
  delete from public.users where id = auth.uid()::text;
end;
$$;

revoke all on function public.delete_my_account_data() from public;
grant execute on function public.delete_my_account_data() to authenticated;
