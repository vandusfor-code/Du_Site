-- ============================================================
-- Gestión de empleo — Validador PILA.
-- El validador NO guarda validaciones ni el PDF: procesa al momento y descarta.
-- Esta migración RETIRA cualquier almacenamiento previo (tablas de validaciones
-- y el bucket del PDF) y deja únicamente la configuración de umbrales, que no
-- contiene datos personales.
-- ============================================================

-- Quitar almacenamiento de validaciones (si se había creado).
drop table if exists public.empleo_registros;
drop table if exists public.empleo_resumen;
drop table if exists public.empleo_validaciones;

-- Borrar cualquier PDF que se hubiera subido y el bucket privado.
delete from storage.objects where bucket_id = 'empleo-pila';
delete from storage.buckets where id = 'empleo-pila';

-- Configuración de umbrales (editable por Admin/Coordinación). Sin datos personales.
create table if not exists public.empleo_config (
  clave          text        primary key,
  valor          jsonb       not null,
  actualizado_en timestamptz not null default now()
);
alter table public.empleo_config enable row level security;
