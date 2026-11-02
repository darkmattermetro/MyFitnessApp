-- Tighten row ownership, add a one-time BYOK key migration path, and validate
-- daily activity patches at the database boundary. Review before applying.

do $$
declare table_to_secure text;
declare policy_to_drop text;
begin
  foreach table_to_secure in array array[
    'users', 'food_entries', 'weight_entries', 'user_preferences',
    'workout_sessions', 'daily_activity', 'user_achievements'
  ] loop
    execute format('alter table public.%I enable row level security', table_to_secure);
    for policy_to_drop in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_to_secure
    loop
      execute format('drop policy if exists %I on public.%I', policy_to_drop, table_to_secure);
    end loop;
  end loop;
end;
$$;

create policy "own users" on public.users
  for all using ((auth.uid()::text) = id)
  with check ((auth.uid()::text) = id);
create policy "own food" on public.food_entries
  for all using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);
create policy "own weight" on public.weight_entries
  for all using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);
create policy "own preferences" on public.user_preferences
  for all using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);
create policy "own workouts" on public.workout_sessions
  for all using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);
create policy "own activity" on public.daily_activity
  for all using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);
create policy "read own achievements" on public.user_achievements
  for select using (auth.uid() = user_id);
create policy "create own achievements" on public.user_achievements
  for insert with check (auth.uid() = user_id);

-- Existing Gemini keys are copied to device SecureStore on first profile load.
-- The client confirms the secure write before this owner-scoped function clears
-- the legacy column, so a local secure-storage failure cannot lose the key.
create or replace function public.migrate_gemini_api_key(p_confirm_stored boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare legacy_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(gemini_api_key, '')
    into legacy_key
    from public.users
    where id = auth.uid()::text
    for update;
  if p_confirm_stored then
    update public.users
      set gemini_api_key = ''
      where id = auth.uid()::text;
    return '';
  end if;
  return coalesce(legacy_key, '');
end;
$$;

revoke all on function public.migrate_gemini_api_key(boolean) from public;
grant execute on function public.migrate_gemini_api_key(boolean) to authenticated;

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
  delete from public.users where id = auth.uid()::text;
end;
$$;

revoke all on function public.delete_my_account_data() from public;
grant execute on function public.delete_my_account_data() to authenticated;

create or replace function public.patch_daily_activity(
  p_day date,
  p_steps integer default null,
  p_water integer default null
)
returns public.daily_activity
language plpgsql
security invoker
set search_path = public
as $$
declare result public.daily_activity;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_steps is not null and (p_steps < 0 or p_steps > 250000) then
    raise exception 'Steps must be between 0 and 250000';
  end if;
  if p_water is not null and (p_water < 0 or p_water > 100) then
    raise exception 'Water count must be between 0 and 100';
  end if;
  insert into public.daily_activity (user_id, day, steps, water, updated_at)
  values (auth.uid()::text, p_day, coalesce(p_steps, 0), coalesce(p_water, 0), now())
  on conflict (user_id, day) do update set
    steps = case when p_steps is null then daily_activity.steps else excluded.steps end,
    water = case when p_water is null then daily_activity.water else excluded.water end,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.patch_daily_activity(date, integer, integer) from public;
grant execute on function public.patch_daily_activity(date, integer, integer) to authenticated;
