-- ============================================================
-- Bonos nativos (Fase 2): auditorías en Supabase para calcular PEC/PENC.
-- Cada auditoría (manual, IA o ChatGPT) guarda aquí su nota y resultado, además
-- de la hoja. Así PEC/PENC se calculan en Du Site sin leer el Excel.
--   PEC  = % de auditorías conformes (OK) del mes, por asesor.
--   PENC = promedio de la nota (%) de las auditorías del mes, por asesor.
-- ============================================================

create table if not exists public.bono_auditoria (
  id_gestion  text        primary key,            -- clave natural (dedup)
  mes         text        not null,               -- 'YYYY-MM' (de la fecha de la auditoría)
  asesor      text        not null,               -- código del asesor (Consolidado col C)
  nota        numeric     not null default 0,     -- nota de calidad (%)
  resultado   text        not null,               -- 'OK' | 'PENC'
  creado_en   timestamptz not null default now()
);

create index if not exists bono_auditoria_mes_asesor_idx on public.bono_auditoria (mes, asesor);
