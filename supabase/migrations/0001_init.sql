-- Crear las tablas para la app Fit en Supabase.
-- Ejecutar en: SQL Editor → tu proyecto (o vía conexión directa).

create table if not exists users (
  id text primary key default 'demo-user',
  objetivo_kcal numeric not null default 2000,
  meta_peso_kg numeric,
  gemini_api_key text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user',
  fecha timestamptz not null default now(),
  texto_original text not null default '',
  items jsonb not null default '[]'::jsonb,
  total_kcal numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user',
  peso_kg numeric not null,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Índices útiles
create index if not exists food_entries_user_fecha_idx
  on food_entries (user_id, fecha desc);
create index if not exists weight_entries_user_measured_idx
  on weight_entries (user_id, measured_at desc);

-- RLS desactivado durante desarrollo (un solo usuario)
alter table users enable row level security;
alter table food_entries enable row level security;
alter table weight_entries enable row level security;
-- Políticas abiertas (SOLO para desarrollo en solitario)
drop policy if exists "dev acceso total users" on users;
create policy "dev acceso total users" on users for all using (true) with check (true);
drop policy if exists "dev acceso total food" on food_entries;
create policy "dev acceso total food" on food_entries for all using (true) with check (true);
drop policy if exists "dev acceso total weight" on weight_entries;
create policy "dev acceso total weight" on weight_entries for all using (true) with check (true);