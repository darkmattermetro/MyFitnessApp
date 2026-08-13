-- Preferencias del usuario para personalizar la IA.
-- Ejecutar en: SQL Editor → tu proyecto (o con scripts/run-migration.js).

create table if not exists user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user',
  texto text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists user_preferences_user_idx
  on user_preferences (user_id);

alter table user_preferences enable row level security;

drop policy if exists "own preferences" on user_preferences;
create policy "own preferences" on user_preferences
  for all
  using ((auth.uid()::text) = user_id)
  with check ((auth.uid()::text) = user_id);
