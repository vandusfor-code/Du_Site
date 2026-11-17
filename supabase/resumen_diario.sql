-- ============================================================
-- Resumen diario de auditorías por asesora. UNA notificación por asesora/día
-- con un resumen (lo positivo + lo que debe mejorar) redactado por IA, y UNA
-- sola firma (acuse) + un compromiso general. Correr una vez en Supabase.
-- ============================================================

create table if not exists public.resumen_diario (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  asesor_codigo  text not null,
  nombre         text not null,
  correo         text,
  num_auditorias int  not null default 0,
  promedio_nota  int,
  positivo       text,
  mejorar        text,
  enviado_en     timestamptz,
  firmado_en     timestamptz,
  compromiso     text,
  creado_en      timestamptz not null default now(),
  unique (fecha, asesor_codigo)
);

create index if not exists resumen_diario_fecha_idx  on public.resumen_diario (fecha);
create index if not exists resumen_diario_nombre_idx on public.resumen_diario (lower(nombre));
