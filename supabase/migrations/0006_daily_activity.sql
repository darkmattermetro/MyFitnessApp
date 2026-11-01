-- Daily activity (steps + water), meal categories and extra user goals.
-- Run in: SQL Editor → your project (or via scripts/run-migration.js).

-- Meals are grouped by category on the Today screen and in History.
alter table food_entries
  add column if not exists meal_type text not null default 'snack';

-- Extra goals used by the Today screen and the weight transformation card.
alter table users
  add column if not exists step_goal integer not null default 8000;
alter table users
  add column if not exists water_goal integer not null default 8;
alter table users
  add column if not exists goal_type text not null default 'maintain';

-- One row per user and day. `day` is a local calendar day (YYYY-MM-DD).
create table if not exists daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  day date not null,
  steps integer not null default 0,
  water integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists daily_activity_user_day_idx
  on daily_activity (user_id, day desc);

alter table daily_activity enable row level security;

drop policy if exists "own activity" on daily_activity;
create policy "own activity" on daily_activity
  for all
  using ((auth.uid()::text) = user_id)
  with check ((auth.uid()::text) = user_id);
