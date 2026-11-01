-- Auth real con Supabase Auth.
-- Ejecutar en: SQL Editor → tu proyecto.
-- Precondición: el proyecto usa Supabase Auth con Email (pedido en dashboard).

-- 1) RLS por usuario (reemplaza las políticas abiertas de dev)
alter table public.users enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;

drop policy if exists "dev acceso total users" on public.users;
drop policy if exists "dev acceso total food" on public.food_entries;
drop policy if exists "dev acceso total weight" on public.weight_entries;
drop policy if exists "own users" on public.users;
drop policy if exists "own food" on public.food_entries;
drop policy if exists "own weight" on public.weight_entries;

create policy "own users" on public.users
  for all
  using ((auth.uid()::text) = id)
  with check ((auth.uid()::text) = id);

create policy "own food" on public.food_entries
  for all
  using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);

create policy "own weight" on public.weight_entries
  for all
  using ((auth.uid()::text) = user_id::text)
  with check ((auth.uid()::text) = user_id::text);

-- 2) Al crear un usuario de auth: crea su fila en users y
--    migra los datos del demo-user a su cuenta (solo la 1ª vez).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, objetivo_kcal, gemini_api_key)
  values (new.id::text, 2000, '')
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.food_entries where user_id = new.id::text
  ) then
    update public.food_entries
    set user_id = new.id::text
    where user_id = 'demo-user';
  end if;

  if not exists (
    select 1 from public.weight_entries where user_id = new.id::text
  ) then
    update public.weight_entries
    set user_id = new.id::text
    where user_id = 'demo-user';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();