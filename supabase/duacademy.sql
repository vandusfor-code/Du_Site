-- ============================================================
-- DuAcademy NATIVO (sin Google Sheets).
-- Cursos con examen + base de conocimiento + progreso/leaderboard, todo en
-- Supabase. Reemplaza las pestañas CURSOS / EXAMENES / PROGRESO / BASE-CONOCIMIENTO.
-- (Las simulaciones con IA quedan fuera de alcance por ahora.)
-- ============================================================

-- Un curso: lección (contenido) + examen.
create table if not exists public.duacademy_cursos (
  id             text        primary key,          -- slug, p.ej. 'CUOTA_MONETARIA'
  titulo         text        not null,
  descripcion    text        not null default '',
  contenido      text        not null default '',  -- lección (texto/markdown)
  umbral         int         not null default 60,  -- % mínimo para aprobar
  num_preguntas  int         not null default 0,
  activo         boolean     not null default false,
  creado_por     text        not null default '',
  creado_en      timestamptz not null default now()
);

-- Preguntas del examen de cada curso (4 opciones A–D, una correcta).
create table if not exists public.duacademy_preguntas (
  curso_id     text  not null references public.duacademy_cursos(id) on delete cascade,
  num          int   not null default 0,
  id_pregunta  text  not null,
  pregunta     text  not null default '',
  opcion_a     text  not null default '',
  opcion_b     text  not null default '',
  opcion_c     text  not null default '',
  opcion_d     text  not null default '',
  correcta     text  not null default '',
  explicacion  text  not null default '',
  primary key (curso_id, id_pregunta)
);

-- Progreso: un resultado por asesora y curso (su examen aprobado/reprobado).
create table if not exists public.duacademy_progreso (
  usuario    text        not null,                 -- código de la asesora
  curso_id   text        not null,
  nota       int         not null default 0,       -- %
  aprobado   boolean     not null default false,
  fecha      timestamptz not null default now(),
  primary key (usuario, curso_id)
);

-- Base de conocimiento: temas de referencia.
create table if not exists public.duacademy_base (
  id         bigserial   primary key,
  tema       text        not null default '',
  info       text        not null default '',
  creado_en  timestamptz not null default now()
);

create index if not exists duacademy_preguntas_curso_idx on public.duacademy_preguntas (curso_id);
create index if not exists duacademy_progreso_curso_idx   on public.duacademy_progreso (curso_id);
create index if not exists duacademy_progreso_usuario_idx on public.duacademy_progreso (usuario);
