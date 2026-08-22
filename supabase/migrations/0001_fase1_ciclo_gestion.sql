-- ============================================================
-- FASE 1 — Ciclo de Gestión de Auditorías
--
-- Crea únicamente ciclo_auditoria y evento_ciclo. NO crea todavía
-- configuracion_recordatorios (reservada para Fase 4).
--
-- No modifica ni toca Consolidado ni ninguna hoja de Google Sheets:
-- estas tablas son exclusivamente de la nueva capa de gestión.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.ciclo_auditoria (
  id uuid primary key default gen_random_uuid(),

  -- Clave natural: igual al ID Gestión de Consolidado!G. Un único
  -- registro de ciclo por auditoría lógica (garantiza idempotencia
  -- a nivel de base de datos, no solo de lógica de aplicación).
  id_gestion text not null unique,

  -- Código de asesor normalizado (mayúsculas) al momento de adoptar.
  -- Consolidado NUNCA se modifica; esta normalización vive solo aquí.
  asesor_codigo text not null,

  -- Copia derivada del resultado de Consolidado!R (Tipo Nota) en el
  -- momento de adopción. Consolidado sigue siendo la fuente de verdad;
  -- esto es solo para no tener que releerlo en cada consulta del ciclo.
  resultado text not null check (resultado in ('OK', 'PENC')),

  estado text not null check (estado in (
    'CREADA',
    'NOTIFICADA',
    'ACUSADA',
    'COMPROMISO_PENDIENTE',
    'COMPROMISO_REGISTRADO',
    'EN_SEGUIMIENTO',
    'CERRADA',
    'NO_ELEGIBLE'
  )),

  motivo_no_elegible text check (motivo_no_elegible in ('SIN_ASESOR_ASOCIADO', 'SIN_CORREO', 'AMBIGUO')),

  -- Correo resuelto desde Funcionarios (identidad), NUNCA copiado del
  -- correo histórico de Consolidado!F. Null si el ciclo es NO_ELEGIBLE.
  correo_notificacion text,

  -- Proyección de Consolidado."Por enviar" = "OK" (columna AC). La FUENTE
  -- de esta decisión sigue siendo Consolidado, siempre — esta columna NO
  -- es una segunda fuente de verdad, es una caché para que el ciclo pueda
  -- consultarse/filtrarse sin releer Sheets. Solo la actualiza el proceso
  -- de detección; nunca se edita a mano. Comportamiento monotónico en V1:
  -- una vez true, no vuelve a false automáticamente (ver migración de la
  -- fase que implemente una cancelación explícita, si llega a existir).
  requiere_compromiso boolean not null default false,
  requiere_compromiso_detectado_en timestamptz,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Regla de negocio a nivel de base: motivo_no_elegible existe si y solo
  -- si el estado es NO_ELEGIBLE. Evita estados inconsistentes por error
  -- de aplicación, no solo por validación en el código.
  constraint chk_motivo_coherente check (
    (estado = 'NO_ELEGIBLE' and motivo_no_elegible is not null) or
    (estado <> 'NO_ELEGIBLE' and motivo_no_elegible is null)
  ),

  -- Misma disciplina para la nueva pareja de columnas: la fecha de
  -- detección existe si y solo si requiere_compromiso es true.
  constraint chk_requiere_compromiso_coherente check (
    (requiere_compromiso = true and requiere_compromiso_detectado_en is not null) or
    (requiere_compromiso = false and requiere_compromiso_detectado_en is null)
  )
);

create index if not exists idx_ciclo_auditoria_asesor on public.ciclo_auditoria (asesor_codigo);
create index if not exists idx_ciclo_auditoria_estado on public.ciclo_auditoria (estado);

-- Mantiene actualizado_en al día en cualquier UPDATE futuro (no se usa
-- todavía en Fase 1, que solo hace INSERT, pero se deja listo para las
-- fases de transición de estado).
create or replace function public.fn_ciclo_auditoria_set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ciclo_auditoria_actualizado_en on public.ciclo_auditoria;
create trigger trg_ciclo_auditoria_actualizado_en
  before update on public.ciclo_auditoria
  for each row execute function public.fn_ciclo_auditoria_set_actualizado_en();

create table if not exists public.evento_ciclo (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclo_auditoria(id) on delete cascade,

  -- Fase 1 genera estos tres tipos. Los de fases futuras
  -- (notificacion_enviada, auditoria_abierta, acuse_registrado,
  -- compromiso_registrado, seguimiento_verificado,
  -- escalamiento_disparado, auditoria_cerrada) se agregarán a este
  -- check en la migración de la fase correspondiente, no ahora.
  --
  -- compromiso_solicitado_por_calidad: registra cuándo se detectó
  -- Consolidado."Por enviar" = "OK" por primera vez para un ciclo. origen
  -- siempre 'automatico' (quien ejecuta la detección es el proceso, no una
  -- persona) — a quién pertenece la DECISIÓN va dentro de detalle
  -- (fuente_decision: "calidad"), nunca inventado como actor, porque
  -- Sheets no nos dice qué usuario editó la celda.
  tipo_evento text not null check (tipo_evento in (
    'auditoria_creada', 'auditoria_no_elegible', 'compromiso_solicitado_por_calidad'
  )),

  origen text not null check (origen in ('automatico', 'asesor', 'calidad', 'supervisor')),
  actor text,
  detalle jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists idx_evento_ciclo_ciclo_id on public.evento_ciclo (ciclo_id, creado_en);

-- RLS activado, sin políticas permisivas. Todo el acceso de Fase 1 pasa
-- por el backend con SUPABASE_SERVICE_ROLE_KEY, que ignora RLS siempre.
-- Esto es una capa defensiva adicional: si en el futuro alguna pantalla
-- llegara a usar el cliente anónimo/autenticado de Supabase directamente,
-- estas tablas no quedan expuestas por defecto.
alter table public.ciclo_auditoria enable row level security;
alter table public.evento_ciclo enable row level security;
