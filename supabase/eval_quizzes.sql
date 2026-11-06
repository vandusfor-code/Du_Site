-- ============================================================
-- Evaluaciones NATIVAS (sin Google Sheets).
-- Reemplaza las pestañas EVAL_QUIZZES / EVAL_PREGUNTAS / EVAL_RESULTADOS.
-- Crear quizzes, activarlos, presentarlos y calificar: todo en Supabase.
-- ============================================================

-- Un quiz/módulo de evaluación.
create table if not exists public.eval_quizzes (
  id             text        primary key,          -- slug, p.ej. 'SEGURIDAD_SST'
  nombre         text        not null,
  descripcion    text        not null default '',
  duracion_min   int         not null default 5,
  umbral         int         not null default 60,  -- % mínimo para aprobar
  num_preguntas  int         not null default 0,
  activo         boolean     not null default false,
  creado_por     text        not null default '',
  creado_en      timestamptz not null default now()
);

-- Preguntas de cada quiz (4 opciones A–D, una correcta).
create table if not exists public.eval_preguntas (
  quiz_id      text  not null references public.eval_quizzes(id) on delete cascade,
  num          int   not null default 0,
  id_pregunta  text  not null,
  pregunta     text  not null default '',
  opcion_a     text  not null default '',
  opcion_b     text  not null default '',
  opcion_c     text  not null default '',
  opcion_d     text  not null default '',
  correcta     text  not null default '',  -- 'A' | 'B' | 'C' | 'D'
  explicacion  text  not null default '',
  primary key (quiz_id, id_pregunta)
);

-- Resultado de una asesora en un quiz. Un intento por asesora (clave usuario+quiz).
create table if not exists public.eval_resultados (
  usuario          text        not null,            -- código de la asesora
  quiz_id          text        not null,
  fecha            timestamptz not null default now(),
  aciertos         int         not null default 0,
  total            int         not null default 0,
  puntaje          int         not null default 0,  -- %
  resultado        text        not null default '', -- 'APROBADO' | 'NO APROBADO'
  respuestas_json  jsonb       not null default '{}'::jsonb,
  falladas         text        not null default '',
  primary key (usuario, quiz_id)
);

create index if not exists eval_preguntas_quiz_idx   on public.eval_preguntas (quiz_id);
create index if not exists eval_resultados_quiz_idx  on public.eval_resultados (quiz_id);
