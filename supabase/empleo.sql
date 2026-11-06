-- ============================================================
-- Gestión de empleo — Validador PILA.
-- El validador NO guarda validaciones ni el PDF: procesa al momento y descarta.
-- Esta migración RETIRA el almacenamiento previo de validaciones y deja solo la
-- configuración de umbrales (sin datos personales).
--
-- El PDF subido de prueba NO se borra por SQL (Supabase lo bloquea): elimínalo
-- desde el panel → Storage → bucket "empleo-pila" → Delete bucket.
-- ============================================================

-- Quitar almacenamiento de validaciones (si se había creado).
drop table if exists public.empleo_registros;
drop table if exists public.empleo_resumen;
drop table if exists public.empleo_validaciones;

-- Configuración de umbrales (editable por Admin/Coordinación). Sin datos personales.
create table if not exists public.empleo_config (
  clave          text        primary key,
  valor          jsonb       not null,
  actualizado_en timestamptz not null default now()
);
alter table public.empleo_config enable row level security;
