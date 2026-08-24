-- ============================================================
-- MÓDULO CALIDAD — migración de base de datos
--
-- NO se ha ejecutado todavía. Revisar y aprobar antes de correr en
-- Supabase. No modifica Consolidado (no puede — vive en Google Sheets,
-- esta migración solo toca Postgres).
--
-- Resumen de lo que hace:
--   1. ciclo_auditoria: agrega fecha_auditoria y fecha_acuse (columnas
--      NULLABLES — ver nota de compatibilidad más abajo).
--   2. ciclo_auditoria.estado: reduce el CHECK a 7 valores, quitando
--      COMPROMISO_REGISTRADO. AUTO-VERIFICABLE: si existiera alguna fila
--      con ese valor, este ALTER TABLE falla con un error claro, sin
--      borrar ni modificar ningún dato — Postgres valida los datos
--      existentes contra el CHECK nuevo antes de aceptarlo.
--   3. Tabla nueva compromiso (1:1 con ciclo_auditoria).
--   4. Tabla nueva configuracion_ciclo (singleton forzado por la base de
--      datos, no por convención de código).
--   5. evento_ciclo.tipo_evento: amplía el CHECK con los eventos nuevos
--      del módulo Calidad. Mismo auto-verificable que el punto 2.
--
-- NOTA DE COMPATIBILIDAD — fecha_auditoria:
-- Se agrega NULLABLE a propósito. Es un snapshot de Consolidado!A que solo
-- existe para ciclos adoptados DESPUÉS de esta migración; los ~1090 ciclos
-- ya existentes quedarán con fecha_auditoria = NULL hasta un backfill
-- posterior (lectura de Consolidado, fuera del alcance de esta etapa — no
-- se hace aquí para no mezclar una migración de esquema con una operación
-- de datos). fecha_acuse en NULL para todo ciclo existente es, en cambio,
-- el valor CORRECTO hoy: ninguno ha sido acusado todavía porque el acuse
-- no existe como funcionalidad hasta este módulo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ciclo_auditoria: columnas nuevas
-- ------------------------------------------------------------
alter table public.ciclo_auditoria
  add column if not exists fecha_auditoria timestamptz,
  add column if not exists fecha_acuse timestamptz;

comment on column public.ciclo_auditoria.fecha_auditoria is
  'Snapshot de Consolidado!A en el momento de adopción. NULL para ciclos adoptados antes de esta migración (pendiente de backfill).';
comment on column public.ciclo_auditoria.fecha_acuse is
  'Cuándo el asesor confirmó explícitamente haber revisado la auditoría. Aplica a CUALQUIER ciclo acusado, tenga o no compromiso (por eso vive aquí y no en compromiso).';

-- ------------------------------------------------------------
-- 2. ciclo_auditoria.estado: CHECK reducido a 7 valores
--    (se quita COMPROMISO_REGISTRADO — decisión aprobada del módulo Calidad)
-- ------------------------------------------------------------
do $$
declare
  nombre_restriccion text;
begin
  select conname into nombre_restriccion
  from pg_constraint
  where conrelid = 'public.ciclo_auditoria'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%estado%CREADA%';

  if nombre_restriccion is not null then
    execute format('alter table public.ciclo_auditoria drop constraint %I', nombre_restriccion);
  end if;
end $$;

alter table public.ciclo_auditoria add constraint ciclo_auditoria_estado_check check (
  estado in (
    'CREADA',
    'NOTIFICADA',
    'ACUSADA',
    'COMPROMISO_PENDIENTE',
    'EN_SEGUIMIENTO',
    'CERRADA',
    'NO_ELEGIBLE'
  )
);

-- ------------------------------------------------------------
-- 3. compromiso — 1:1 con ciclo_auditoria
-- ------------------------------------------------------------
create table if not exists public.compromiso (
  id uuid primary key default gen_random_uuid(),

  ciclo_id uuid not null unique references public.ciclo_auditoria(id) on delete cascade,

  -- Contenido escrito por el asesor. Modificable hasta la verificación
  -- (ver constraint de coherencia más abajo, que congela todo lo demás
  -- una vez que cumplimiento deja de ser PENDIENTE).
  texto_compromiso text not null,

  fecha_registro timestamptz not null default now(),
  registrado_por text not null,

  -- fecha_prometida_original: el resultado exacto del cálculo automático
  -- (sumarDiasHabiles), escrito UNA sola vez y nunca modificado después.
  -- fecha_prometida: el valor VIGENTE — igual al original salvo que
  -- Calidad lo haya ajustado excepcionalmente (evento
  -- compromiso_fecha_prometida_ajustada, con justificación obligatoria).
  -- Que difieran ya ES la señal de "esta fecha fue ajustada" — no hace
  -- falta un booleano aparte.
  fecha_prometida_original timestamptz not null,
  fecha_prometida timestamptz not null,

  cumplimiento text not null default 'PENDIENTE' check (cumplimiento in ('PENDIENTE', 'CUMPLIDO', 'INCUMPLIDO')),

  fecha_verificacion timestamptz,
  verificado_por text,
  observacion_verificacion text,
  fecha_cierre timestamptz,

  -- Igual disciplina que ciclo_auditoria: los campos de verificación
  -- existen si y solo si cumplimiento ya no es PENDIENTE. Evita estados
  -- inconsistentes por error de aplicación, no solo por validación en código.
  constraint chk_compromiso_verificacion_coherente check (
    (cumplimiento = 'PENDIENTE'
      and fecha_verificacion is null and verificado_por is null
      and observacion_verificacion is null and fecha_cierre is null)
    or
    (cumplimiento in ('CUMPLIDO', 'INCUMPLIDO')
      and fecha_verificacion is not null and verificado_por is not null
      and observacion_verificacion is not null and fecha_cierre is not null)
  )
);

comment on table public.compromiso is
  'Compromiso de mejora registrado por el asesor. 1:1 con ciclo_auditoria. Solo existe si de verdad se registró un compromiso.';

-- Índice parcial: acelera exactamente la consulta de "vencidas" del panel
-- (fecha_prometida < now() AND cumplimiento='PENDIENTE'), sin indexar filas
-- que ya están cerradas y nunca participan de esa condición.
create index if not exists idx_compromiso_vencimiento
  on public.compromiso (fecha_prometida)
  where cumplimiento = 'PENDIENTE';

alter table public.compromiso enable row level security;

-- ------------------------------------------------------------
-- 4. configuracion_ciclo — singleton GARANTIZADO por la base de datos
--    (no por convención de aplicación): llave primaria boolean forzada
--    a valer siempre true por el CHECK. Un segundo INSERT choca contra
--    la unicidad de la llave primaria, sin importar qué haga el código.
-- ------------------------------------------------------------
create table if not exists public.configuracion_ciclo (
  id boolean primary key default true,
  constraint una_sola_fila check (id),

  dias_habiles_compromiso integer not null,

  actualizado_en timestamptz not null default now(),
  actualizado_por text not null
);

comment on table public.configuracion_ciclo is
  'Configuración de una sola fila (garantizada por la base de datos) para el módulo Calidad. Hoy solo dias_habiles_compromiso.';

alter table public.configuracion_ciclo enable row level security;

-- Siembra la única fila. dias_habiles_compromiso = 2 es el VALOR DEFINITIVO
-- de producción (aprobado): máximo 2 días hábiles para registrar el
-- compromiso, contados desde el día siguiente al registro (día 0 = día del
-- registro, nunca cuenta; día hábil 1; día hábil 2), excluyendo sábados,
-- domingos y festivos colombianos. Ajustable después solo vía:
--   update public.configuracion_ciclo set dias_habiles_compromiso = N,
--     actualizado_en = now(), actualizado_por = '<usuario>' where id = true;
insert into public.configuracion_ciclo (dias_habiles_compromiso, actualizado_por)
values (2, 'migracion_inicial')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. evento_ciclo.tipo_evento — CHECK ampliado con los eventos del
--    módulo Calidad
-- ------------------------------------------------------------
do $$
declare
  nombre_restriccion text;
begin
  select conname into nombre_restriccion
  from pg_constraint
  where conrelid = 'public.evento_ciclo'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%tipo_evento%';

  if nombre_restriccion is not null then
    execute format('alter table public.evento_ciclo drop constraint %I', nombre_restriccion);
  end if;
end $$;

alter table public.evento_ciclo add constraint evento_ciclo_tipo_evento_check check (
  tipo_evento in (
    'auditoria_creada',
    'auditoria_no_elegible',
    'compromiso_solicitado_por_calidad',
    'notificacion_enviada',
    'notificacion_fallida',
    'auditoria_acusada',
    'compromiso_registrado',
    'compromiso_fecha_prometida_ajustada',
    'compromiso_verificado',
    'auditoria_cerrada',
    'recordatorio_acuse_enviado',
    'recordatorio_compromiso_enviado',
    'escalamiento_incluido'
  )
);
