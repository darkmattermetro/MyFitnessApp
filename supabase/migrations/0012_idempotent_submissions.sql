alter table public.food_entries
  add column if not exists client_request_id text;
alter table public.workout_sessions
  add column if not exists client_request_id text;

create unique index if not exists food_entries_user_request_uidx
  on public.food_entries (user_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists workout_sessions_user_request_uidx
  on public.workout_sessions (user_id, client_request_id)
  where client_request_id is not null;
