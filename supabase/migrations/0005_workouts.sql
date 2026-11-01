-- Workout logging: one row per session, with the exercises and sets as JSONB.
-- Run in: SQL Editor → your project (or via scripts/run-migration.js).

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user',
  name text not null default 'Workout',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_min numeric,
  notes text not null default '',
  -- [{ "id": "...", "name": "Bench Press", "muscle": "chest",
  --    "sets": [{ "weight": 60, "reps": 10 }] }]
  exercises jsonb not null default '[]'::jsonb,
  total_volume_kg numeric not null default 0,
  total_sets integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_started_idx
  on workout_sessions (user_id, started_at desc);

alter table workout_sessions enable row level security;

drop policy if exists "own workouts" on workout_sessions;
create policy "own workouts" on workout_sessions
  for all
  using ((auth.uid()::text) = user_id)
  with check ((auth.uid()::text) = user_id);
