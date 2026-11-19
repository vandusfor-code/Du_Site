-- Marca cuándo se escaló a Coordinación (Mónica) la firma vencida de una asesora.
alter table public.resumen_diario add column if not exists escalado_en timestamptz;
