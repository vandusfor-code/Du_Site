-- ============================================================
-- FASE 1 — Notificación al asesor (paso 1 de la cadena de gestión)
--
-- Agrega dos tipos de evento nuevos a evento_ciclo.tipo_evento:
--   - notificacion_enviada: el SMTP confirmó que aceptó el correo.
--   - notificacion_fallida: el intento de envío falló o el correo
--     resuelto no coincidía con el snapshot — no crea NI cambia estado,
--     es solo trazabilidad del error (ver src/lib/notificacion-por-enviar.ts).
--     Reutiliza evento_ciclo como bitácora en vez de crear una tabla nueva
--     o escribir en una hoja de Sheets.
--
-- No toca ciclo_auditoria en absoluto. No modifica datos existentes.
-- ============================================================

-- Busca el nombre real de la restricción CHECK sobre tipo_evento (Postgres
-- la nombró automáticamente al crear la tabla; no se asume el nombre) y la
-- reemplaza por una que incluya los dos valores nuevos.
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
    'notificacion_fallida'
  )
);
