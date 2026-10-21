# Envío de auditorías por asesora + ciclo de seguimiento

Sección «Envío de auditorías» dentro de la pantalla **Auditoría ChatGPT** y las
transiciones de ciclo que faltaban (acuse / compromiso). Reutiliza la
infraestructura existente (Google Sheets, Supabase `ciclo_auditoria` /
`evento_ciclo` / `compromiso`, `mailer.ts`, plantillas, portal de asesoras).

## Archivos
- Lógica pura + tipos: [`src/lib/envio-auditorias-tipos.ts`](../src/lib/envio-auditorias-tipos.ts) (+ `.test.mjs`).
- Lectura + envío por lote (servidor): [`src/lib/envio-auditorias.ts`](../src/lib/envio-auditorias.ts).
- Acuse + compromiso (servidor): [`src/lib/acuse-compromiso-ciclo.ts`](../src/lib/acuse-compromiso-ciclo.ts).
- Plantilla de lote: `correoLoteAuditorias()` en [`src/lib/emailTemplates.ts`](../src/lib/emailTemplates.ts).
- Acciones: [`src/app/admin/actions.ts`](../src/app/admin/actions.ts) (envío) y [`src/app/modulos/metricas/actions.ts`](../src/app/modulos/metricas/actions.ts) (acuse/compromiso).
- UI: [`src/app/admin/EnvioAuditorias.tsx`](../src/app/admin/EnvioAuditorias.tsx) + sub-pestañas en `AdminDashboard.tsx`.

## Decisiones

### Un correo por asesora y lote
El correo de lote (`correoLoteAuditorias`) anuncia cuántas auditorías hay y la
fecha, y enlaza al **portal existente** (`/modulos/metricas?seccion=auditorias`),
donde la asesora, ya autenticada, ve y filtra solo las suyas. No se envía un
correo por auditoría ni se adjuntan datos sensibles: los detalles se consultan
tras iniciar sesión. Cada auditoría conserva su `id_gestion` y su fila de ciclo;
el correo es por asesora, la **trazabilidad es por auditoría** (un evento
`notificacion_enviada` por ciclo, con `tipo_notificacion: "lote_auditorias"`).

### Identidad y correo oficiales
Código, nombre, correo y canal provienen SIEMPRE de `Funcionarios` (A, B, C, E).
La columna D (contraseña) no se lee. El correo se revalida en vivo al enviar
(`revalidarCorreoAsesor`) y se compara con el snapshot del ciclo (fail-closed):
nunca se usa un correo del JSON ni del navegador.

### Idempotencia del envío — límite real (⚠ requiere migración para cron)
El envío es **manual y de a una ejecución**. Como en `notificacion-por-enviar.ts`,
el correo se envía **antes** del `UPDATE` condicional `CREADA→NOTIFICADA` (para no
marcar NOTIFICADA sin haber enviado). El `UPDATE` con `WHERE estado='CREADA'` evita
re-notificar en una segunda corrida, y el botón se deshabilita mientras procesa.
**Queda una ventana de carrera** si dos ejecuciones corren a la vez.
Para una reclamación atómica real (necesaria antes de conectar un cron) hace falta
un estado/columna intermedios, lo que implica una **migración de Supabase**:

```sql
-- PROPUESTA (NO ejecutada). Reclamo atómico previo al envío.
ALTER TABLE ciclo_auditoria ADD COLUMN notificacion_reclamada_en timestamptz NULL;
-- Flujo: UPDATE ... SET notificacion_reclamada_en = now()
--        WHERE estado='CREADA' AND notificacion_reclamada_en IS NULL
--        RETURNING id;   -- solo una corrida reclama cada ciclo
-- Enviar el correo para los reclamados; luego UPDATE estado='NOTIFICADA'.
-- Si el envío falla: limpiar notificacion_reclamada_en para reintentar.
```
Impacto: aditivo, sin tocar datos existentes. **Pendiente de autorización.**

### Acuse y compromiso — fuente de verdad
La migración 0003 ya creó los estados `ACUSADA` / `COMPROMISO_PENDIENTE` /
`EN_SEGUIMIENTO` / `CERRADA`, `fecha_acuse` y las tablas `compromiso` /
`configuracion_ciclo`, así que **no se requiere migración nueva** para acuse ni
compromiso. Transiciones implementadas (idempotentes, con `UPDATE` condicional):
- **Acuse:** `NOTIFICADA → COMPROMISO_PENDIENTE` (si `requiere_compromiso`) o
  `→ ACUSADA` (si no). Registra `fecha_acuse` (hora del servidor) + evento
  `acuse_registrado`. El acuse es **recepción**, no aceptación del resultado.
- **Compromiso:** `COMPROMISO_PENDIENTE → EN_SEGUIMIENTO`, inserta la fila
  `compromiso` (`PENDIENTE`, `fecha_prometida` por días hábiles de
  `configuracion_ciclo`) + evento `compromiso_registrado`. **Firma individual por
  auditoría** (no se sustituye por una aceptación masiva).
- **Cierre:** ya existía (`verificarCumplimiento`, `EN_SEGUIMIENTO → CERRADA`).

**Fuente autoritativa del ciclo = Supabase.** La hoja `Compromisos` (que hoy
escribe el portal) se conserva como **espejo best-effort** para no romper las
vistas actuales de métricas; ante discrepancia, Supabase manda. `firmarCompromisoAction`
escribe primero Supabase (autoritativo) y luego el espejo en Sheets (si falla el
espejo, el ciclo ya quedó correcto en Supabase).

### Recordatorios / vencidos
Al implementarse el acuse, los ciclos salen de `NOTIFICADA` al ser acusados, de
modo que `idsVencidosSinAcuse` (que mira `NOTIFICADA` + 2 días hábiles desde la
notificación) deja de marcar como vencidas **todas** las notificadas: solo las
que de verdad no se acusaron a tiempo.

## Estado de verificación
- **Verificado:** lógica pura de agrupación/transiciones (unit tests), type-check,
  lint, y render de la UI de la sección (con datos de prueba; la acción de datos
  real requiere credenciales).
- **NO verificado en ejecución (código-only):** envío real por SMTP, escrituras y
  transiciones en Supabase (acuse/compromiso), y el flujo extremo a extremo. No hay
  credenciales de Supabase/SMTP en el entorno local ni se enviaron correos reales.
- **Pendiente de UI:** conectar los botones de **acuse** y **compromiso** del portal
  de asesoras (`MetricasDashboard.tsx`) a `registrarAcuseAction` /
  `firmarCompromisoAction` y mostrar el estado del ciclo (hoy ese componente lee solo
  la hoja). Las acciones de servidor ya están listas.
