-- ============================================================
-- Gestión de empleo — Validador PILA. Persistencia en Supabase.
-- Cada validación guarda su resultado + los registros extraídos + el resumen
-- por periodo, de forma AUDITABLE y reproducible (se guarda la versión del
-- motor de reglas con que se calculó).
--
-- Privacidad: el documento contiene datos personales. RLS queda ACTIVADA sin
-- políticas públicas: solo el service-role del servidor (que la omite) accede;
-- el filtrado por asesor/rol se hace en las server actions. Nada queda expuesto
-- al cliente anónimo/autenticado directo.
-- ============================================================

create extension if not exists pgcrypto;

-- Encabezado de cada validación.
create table if not exists public.empleo_validaciones (
  id                  uuid        primary key default gen_random_uuid(),
  asesor_codigo       text        not null,
  asesor_nombre       text        not null default '',
  trabajador_nombre   text        not null default '',
  trabajador_documento text       not null default '',
  tipo_trabajador     text        not null,              -- 'dependiente' | 'independiente'
  fecha_solicitud     date        not null,
  ventana_desde       date,
  ventana_hasta       date,
  dias_requeridos     int         not null default 0,
  dias_acreditados    int         not null default 0,
  dias_diferencia     int         not null default 0,
  periodos_con_aporte int         not null default 0,
  estado              text        not null,              -- CUMPLE | NO_CUMPLE | REQUIERE_REVISION
  motivo              text        not null default '',
  archivo_nombre      text        not null default '',
  archivo_ruta        text,                              -- ruta en storage privado (opcional)
  observacion_auto    text        not null default '',
  observacion_asesor  text        not null default '',
  version_motor       text        not null default '',
  analisis            jsonb       not null default '{}'::jsonb,
  inconsistencias     jsonb       not null default '[]'::jsonb,
  creado_en           timestamptz not null default now()
);

-- Registros individuales extraídos del PDF (traza del cálculo).
create table if not exists public.empleo_registros (
  id             bigserial   primary key,
  validacion_id  uuid        not null references public.empleo_validaciones(id) on delete cascade,
  fila           int         not null default 0,
  nit            text        not null default '',
  periodo        text        not null default '',
  fecha_pago     text        not null default '',
  aporte         numeric     not null default 0,
  salario_basico numeric,
  ibc            numeric,
  dias_cot       int         not null default 0,
  planilla       text,
  novedades      jsonb       not null default '[]'::jsonb,
  estado_registro text       not null default '',        -- contabilizado | excluido | revisar
  motivo_exclusion text      not null default '',
  crudo          text        not null default ''
);

-- Resumen consolidado por periodo.
create table if not exists public.empleo_resumen (
  id               bigserial   primary key,
  validacion_id    uuid        not null references public.empleo_validaciones(id) on delete cascade,
  periodo          text        not null,
  nits             jsonb       not null default '[]'::jsonb,
  registros        int         not null default 0,
  dias_reportados  int         not null default 0,
  dias_reconocidos int         not null default 0,
  aporte_acumulado numeric     not null default 0,
  novedades        jsonb       not null default '[]'::jsonb,
  estado           text        not null default '',
  excede_limite    boolean     not null default false,
  fuera_ventana    boolean     not null default false
);

-- Configuración de reglas (umbrales operativos editables por un administrador).
create table if not exists public.empleo_config (
  clave      text        primary key,
  valor      jsonb       not null,
  actualizado_en timestamptz not null default now()
);

create index if not exists empleo_val_asesor_idx  on public.empleo_validaciones (asesor_codigo);
create index if not exists empleo_val_fecha_idx   on public.empleo_validaciones (creado_en desc);
create index if not exists empleo_val_estado_idx  on public.empleo_validaciones (estado);
create index if not exists empleo_reg_val_idx     on public.empleo_registros (validacion_id);
create index if not exists empleo_res_val_idx     on public.empleo_resumen (validacion_id);

alter table public.empleo_validaciones enable row level security;
alter table public.empleo_registros    enable row level security;
alter table public.empleo_resumen      enable row level security;
alter table public.empleo_config       enable row level security;
