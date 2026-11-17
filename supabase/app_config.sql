-- ============================================================
-- Configuración de la app (clave-valor). Guarda, entre otras cosas, la API key
-- de OpenAI y el modelo/motor del auditor con IA, editables desde el panel de
-- administración. Correr una vez en el SQL Editor de Supabase.
-- La key se lee SOLO server-side (SERVICE_ROLE); nunca se expone al navegador.
-- ============================================================

create table if not exists public.app_config (
  clave        text primary key,
  valor        text,
  actualizado_en timestamptz not null default now()
);

-- Valores por defecto (no sobrescribe si ya existen).
insert into public.app_config (clave, valor) values
  ('openai_modelo', 'gpt-4o-mini'),
  ('auditor_motor', 'claude')
on conflict (clave) do nothing;
