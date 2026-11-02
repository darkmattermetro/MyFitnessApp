-- Keep provider totals, on-device/manual counts and corrections separate.
-- Existing rows are preserved as legacy/manual values because their source
-- cannot be established retrospectively.
alter table public.daily_activity
  add column if not exists steps_provider integer,
  add column if not exists steps_manual integer not null default 0,
  add column if not exists steps_adjustment integer not null default 0,
  add column if not exists steps_provider_source text;

update public.daily_activity
set steps_manual = steps
where steps_provider is null and steps_manual = 0 and steps > 0;

create or replace function public.patch_daily_activity(
  p_day date,
  p_steps integer default null,
  p_water integer default null,
  p_steps_provider integer default null,
  p_provider_source text default null,
  p_steps_manual_delta integer default null,
  p_steps_adjustment_delta integer default null
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
  if p_steps_provider is not null and (p_steps_provider < 0 or p_steps_provider > 250000) then
    raise exception 'Provider steps must be between 0 and 250000';
  end if;
  if p_steps_manual_delta is not null and (p_steps_manual_delta < 0 or p_steps_manual_delta > 250000) then
    raise exception 'Manual step increments must be between 0 and 250000';
  end if;
  if p_steps_adjustment_delta is not null and (p_steps_adjustment_delta < -250000 or p_steps_adjustment_delta > 250000) then
    raise exception 'Step adjustments must be between -250000 and 250000';
  end if;
  if p_water is not null and (p_water < 0 or p_water > 100) then
    raise exception 'Water count must be between 0 and 100';
  end if;
  if p_steps_provider is not null and (p_provider_source is null or p_provider_source not in ('health_connect', 'google_fit')) then
    raise exception 'Provider source must be Health Connect or Google Fit';
  end if;

  insert into public.daily_activity (
    user_id, day, steps, water, steps_provider, steps_manual,
    steps_adjustment, steps_provider_source, updated_at
  )
  values (
    auth.uid()::text,
    p_day,
    case
      when p_steps is not null then p_steps
      when p_steps_provider is not null then greatest(0, p_steps_provider + coalesce(p_steps_adjustment_delta, 0))
      else greatest(0, coalesce(p_steps_manual_delta, 0) + coalesce(p_steps_adjustment_delta, 0))
    end,
    coalesce(p_water, 0),
    p_steps_provider,
    coalesce(p_steps, 0) + coalesce(p_steps_manual_delta, 0),
    case when p_steps is not null then 0 else coalesce(p_steps_adjustment_delta, 0) end,
    case when p_steps_provider is not null then p_provider_source when p_steps is not null then 'manual' else null end,
    now()
  )
  on conflict (user_id, day) do update set
    steps_provider = case
      when p_steps is not null then null
      when p_steps_provider is not null then p_steps_provider
      else daily_activity.steps_provider
    end,
    steps_manual = case
      when p_steps is not null then p_steps
      when p_steps_manual_delta is not null then daily_activity.steps_manual + p_steps_manual_delta
      else daily_activity.steps_manual
    end,
    steps_adjustment = case
      when p_steps is not null then 0
      when p_steps_adjustment_delta is not null then daily_activity.steps_adjustment + p_steps_adjustment_delta
      else daily_activity.steps_adjustment
    end,
    steps_provider_source = case
      when p_steps is not null then null
      when p_steps_provider is not null then p_provider_source
      else daily_activity.steps_provider_source
    end,
    steps = case
      when p_steps is not null then p_steps
      when p_steps_provider is not null then greatest(0, p_steps_provider + daily_activity.steps_adjustment + coalesce(p_steps_adjustment_delta, 0))
      when daily_activity.steps_provider is not null then greatest(0, daily_activity.steps_provider + daily_activity.steps_adjustment + coalesce(p_steps_adjustment_delta, 0))
      else greatest(0, daily_activity.steps_manual + coalesce(p_steps_manual_delta, 0) + daily_activity.steps_adjustment + coalesce(p_steps_adjustment_delta, 0))
    end,
    water = case when p_water is null then daily_activity.water else p_water end,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.patch_daily_activity(date, integer, integer, integer, text, integer, integer) from public;
grant execute on function public.patch_daily_activity(date, integer, integer, integer, text, integer, integer) to authenticated;

-- Retire the old overload so callers cannot bypass the source-aware routine.
drop function if exists public.patch_daily_activity(date, integer, integer);
