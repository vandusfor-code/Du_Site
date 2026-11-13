-- ============================================================
-- Plataforma de formación Huspy (ruta pública /huspy, sin login).
-- Guarda el resultado de cada asesora (nombre + nota + detalle por actividad).
-- Correr una vez en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.huspy_resultados (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  nota        integer not null default 0,          -- nota final 0..100
  detalle     jsonb  not null default '{}'::jsonb,  -- { act1, act2, act3, act4, aciertos, intentos }
  creado_en   timestamptz not null default now()
);

create index if not exists huspy_resultados_nombre_idx on public.huspy_resultados (nombre);
create index if not exists huspy_resultados_creado_idx on public.huspy_resultados (creado_en desc);

-- La app escribe con la SERVICE_ROLE (server-side), así que no se necesitan
-- políticas RLS para el flujo actual. Si se habilita RLS, agregar políticas.
