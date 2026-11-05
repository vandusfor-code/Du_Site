-- ============================================================
-- Bonos nativos (Fase 2): almacenamiento propio en Supabase.
-- Reemplaza la captura manual en el Excel. No afecta la hoja del usuario.
-- ============================================================

-- Métricas MANUALES del bono, capturadas desde la plataforma Du Site.
-- Clave: mes + asesor (código, p.ej. 'A.BANDA483') + campo ('satisfaccion'...).
create table if not exists public.bono_metrica_manual (
  mes             text        not null,            -- 'YYYY-MM'
  asesor          text        not null,            -- código del asesor
  campo           text        not null,            -- métrica manual
  valor           text        not null default '', -- valor capturado (p.ej. '98%')
  actualizado_en  timestamptz not null default now(),
  primary key (mes, asesor, campo)
);

-- Configuración del módulo de bonos (p.ej. mes activo nativo).
create table if not exists public.bono_config (
  clave  text primary key,
  valor  text not null default ''
);

-- Histórico de cierres: snapshot completo por mes/asesor (consultable y editable).
create table if not exists public.bono_historico (
  mes         text        not null,
  asesor      text        not null,
  nombre      text        not null default '',
  area        text        not null default '',
  datos       jsonb       not null default '{}'::jsonb,  -- métricas + bono del mes
  cerrado_en  timestamptz not null default now(),
  primary key (mes, asesor)
);

create index if not exists bono_metrica_manual_mes_idx on public.bono_metrica_manual (mes);
create index if not exists bono_historico_mes_idx       on public.bono_historico (mes);
