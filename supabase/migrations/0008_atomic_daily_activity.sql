-- Patch a single activity field atomically so a step sync cannot replace water
-- (or vice versa) with a stale client snapshot.
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
