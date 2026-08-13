-- Métricas del perfil: altura, sexo, edad y actividad para IMC y calorías.
-- Ejecutar en: SQL Editor → tu proyecto.

alter table users add column if not exists altura_cm numeric;
alter table users add column if not exists sexo text not null default '';
alter table users add column if not exists edad numeric;
alter table users add column if not exists nivel_actividad numeric not null default 1.2;