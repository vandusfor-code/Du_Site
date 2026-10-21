# Contrato AUDITORIA_CO_V1 — ChatGPT → Du Site

Formato estructurado que ChatGPT devuelve y que la modalidad **Auditoría ChatGPT**
de Du Site interpreta, valida y registra. El intercambio es por **copiar y pegar**:
Du Site **no** llama a la API de OpenAI.

- **Identificador de formato:** `AUDITORIA_CO_V1`
- **Versión:** `1`
- **Parser (fuente):** [`src/lib/auditoria-chatgpt-contrato.ts`](../src/lib/auditoria-chatgpt-contrato.ts)
- **Pruebas:** [`src/lib/auditoria-chatgpt-contrato.test.mjs`](../src/lib/auditoria-chatgpt-contrato.test.mjs)
- **Persistencia:** `guardarAuditoriaChatGPTAction` → `guardarAuditoriaChatGPT` (valida/
  resuelve el asesor oficial) → `guardarAuditoriaManual` (misma hoja `Consolidado`, mismas
  columnas, misma regla de nota, misma deduplicación por ID). No crea columnas, pestañas ni
  bases de datos nuevas.
- **Prompt universal:** `construirPromptUniversal()` en el mismo módulo del contrato (única
  fuente, derivada de sus constantes). El botón «Copiar prompt universal» de la pantalla de
  importación copia ese texto.

---

## 0. Directorio oficial de asesores (hoja `Funcionarios`)

Fuente oficial de la identidad del asesor. Columnas: **A** código, **B** correo, **C** canal,
**D** contraseña, **E** nombre, **F** fecha de llamada. Auditoría ChatGPT lee **solo A, B, C y E**
(`obtenerFuncionariosParaSelector`); la **columna D (contraseña) jamás se lee, se envía al
navegador ni se registra**. La columna **F (FECHA DE LLAMADA) no es** la fecha de registro de
la auditoría. El código, nombre, correo y canal del registro oficial **nunca** se sobrescriben
con valores del JSON ni del navegador; si el asesor no existe, el guardado se rechaza.

---

## 1. Esquema JSON

```jsonc
{
  "formato": "AUDITORIA_CO_V1",   // obligatorio, literal
  "version": 1,                    // opcional; si está, debe ser 1

  "interaccion": {
    // Los tres campos siguientes son INFORMATIVOS: los controla el formulario de
    // Du Site (fuente de verdad), no el JSON. Si vienen y difieren, se muestra un
    // aviso pero se conserva el valor de Du Site.
    "asesor":             "string",     // OPCIONAL — identidad = selector manual + Funcionarios
    "id_gestion":         "string",     // OPCIONAL — el ID real se escribe en Du Site
    "fecha":              "AAAA-MM-DD", // OPCIONAL — la fecha de registro la fija Du Site (hoy Bogotá)
    "canal":              "string", // opcional (p. ej. "Llamada" | "Chat")
    "tipo_gestion":       "string", // opcional (por defecto "Consulta")
    "correo_corporativo": "string", // opcional
    "evaluador":          "string", // opcional (por defecto, el usuario que guarda)
    "tipo_consulta":      "string", // opcional (motivo principal)
    "grabacion":          "string"  // opcional (enlace)
  },

  "criterios": {                    // OBLIGATORIO — los 8 criterios por su clave estable
    "saludo":      { "resultado": "Cumple", "evidencia": "..." },
    "empatia":     { "resultado": "No cumple", "evidencia": "..." },
    "sonrisa":     { "resultado": "Cumple" },
    "claridad":    { "resultado": "Cumple" },
    "encuesta":    { "resultado": "No aplica" },
    "informacion": { "resultado": "Cumple" },
    "proceso":     { "resultado": "Cumple" },
    "cierre":      { "resultado": "Cumple" }
  },

  "puntaje_tuteo":           "Sin tuteo",   // opcional; por defecto "Sin tuteo"
  "observacion":             "string",       // opcional
  "hallazgos":               "string",       // opcional
  "puntos_mejora":           "string",       // opcional

  "nota_propuesta":          100,            // opcional, SOLO informativo
  "clasificacion_propuesta": "OK"            // opcional, SOLO informativo
}
```

### Notas de interpretación
- Cada criterio se asigna **por su clave** (`saludo`, `empatia`, …), **nunca por posición**.
- `criterios.<id>` admite **objeto** `{ "resultado", "evidencia" }` o **cadena simple**
  (`"saludo": "Cumple"`). La `evidencia` es opcional y se muestra en la vista previa.
- El `evaluador` y los datos de `interaccion` también pueden ir en el nivel superior si no
  existe el objeto `interaccion` (el parser lee primero `interaccion`, luego el nivel superior).

---

## 2. Tipos y valores permitidos

| Campo | Tipo | Valores permitidos |
|---|---|---|
| `formato` | string | `"AUDITORIA_CO_V1"` (exacto) |
| `version` | number | `1` |
| `interaccion.fecha` | string | `AAAA-MM-DD` (fecha real; se rechaza `2026-13-40`) |
| `criterios.<id>.resultado` | string | `"Cumple"` · `"No cumple"` · `"No aplica"` |
| `puntaje_tuteo` | string | `"Sin tuteo"` · `"Tuteo leve"` · `"Tuteo real"` |
| `nota_propuesta` | number | 0–100 (informativo) |
| `clasificacion_propuesta` | string | `"OK"` · `"PENC"` (informativo) |

**Claves de criterio (estables):** `saludo`, `empatia`, `sonrisa`, `claridad`,
`encuesta`, `informacion`, `proceso`, `cierre`. Cualquier otra clave dentro de
`criterios` se **rechaza** como criterio desconocido.

### Obligatorio vs opcional
- **Obligatorios en el JSON:** `formato` y los **8 criterios** con un `resultado` válido.
- **Opcionales en el JSON:** todo lo demás, incluidos `interaccion.asesor`,
  `interaccion.id_gestion` e `interaccion.fecha` (los controla el formulario).

### Datos administrativos (fuente de verdad = Du Site, no el JSON)
El JSON solo aporta valores informativos; si difieren, se muestra un aviso sin sobrescribir:
- **Asesor (código) y nombre:** del selector manual obligatorio, poblado desde `Funcionarios`.
  El servidor revalida que exista antes de guardar.
- **Correo y canal:** se resuelven del registro oficial del asesor (`Funcionarios` B y C),
  nunca del JSON ni del navegador. En la revisión se muestran como **solo lectura**.
- **ID de gestión:** campo manual obligatorio, capturado **antes** de interpretar el JSON.
  Prevalece sobre `interaccion.id_gestion`. El servidor lo valida y mantiene la protección
  contra duplicados por ID.
- **Fecha de registro:** inicializada automáticamente al **día actual en `America/Bogota`**,
  editable en la revisión. Prevalece sobre `interaccion.fecha`. No es la `FECHA DE LLAMADA`
  del directorio.

Asesor, ID y fecha se **conservan** al pulsar «Volver a importar» y ante errores de
validación/guardado. Tras un guardado correcto se limpia solo el ID (cada interacción es única).

---

## 3. Reglas de validación

El parser distingue y reporta seis situaciones:

| Código | Severidad | Significado |
|---|---|---|
| `json_malformado` / `no_es_objeto` | error | El bloque no es JSON válido o no es un objeto |
| `formato_invalido` / `version_desconocida` | error | `formato` ≠ `AUDITORIA_CO_V1` o `version` ≠ 1 |
| `obligatorio_ausente` | error | Falta un dato obligatorio (campo o criterio) |
| `valor_no_permitido` | error | Un valor fuera del dominio permitido |
| `criterio_desconocido` | error | Una clave de criterio inexistente |
| `fecha_invalida` | error | Fecha con formato o valor imposible |
| `opcional_ausente` | advertencia | Falta un dato opcional |
| `criterio_no_aplica` | advertencia | Un criterio quedó en `"No aplica"` (revisar) |
| `nota_inconsistente` | advertencia | La nota/clasificación propuesta ≠ la oficial |

- **Solo los `error` bloquean el guardado.** Las `advertencia` son informativas.
- El parser **no repara** datos ambiguos ni ejecuta el contenido pegado. Ante una
  ambigüedad, pide corregir el bloque o el campo.
- La interpretación es **100 % local**: no escribe en Google Sheets ni llama a ningún
  modelo de IA.

---

## 4. Nota y clasificación (regla oficial — no modificada)

La nota se calcula con la **misma regla** que `calcularNotaManual` en
[`src/lib/auditorias-admin.ts`](../src/lib/auditorias-admin.ts):

- Afectan la nota **6 criterios**: Saludo, Empatía, Sonrisa, Claridad, Encuesta, Cierre.
  **Información y Proceso NO afectan la nota.**
- Los criterios en `"No aplica"` se **excluyen** del cálculo.
- **Hasta 2** incumplimientos → **nota 100 %, clasificación OK**.
- **3 o más** incumplimientos → clasificación **PENC** con nota = `cumplen / evaluados`.

`nota_propuesta` y `clasificacion_propuesta` de ChatGPT son **solo informativas**: si no
coinciden con la oficial se muestra una advertencia y **prevalece la oficial**. El servidor
**recalcula** la nota al guardar; nunca confía en un valor enviado desde el navegador.

---

## 5. Ejemplo válido (datos ficticios)

```json
{
  "formato": "AUDITORIA_CO_V1",
  "version": 1,
  "interaccion": {
    "asesor": "J.PEREZ123",
    "canal": "Llamada",
    "fecha": "2026-03-15",
    "id_gestion": "GEST-00042",
    "tipo_gestion": "Consulta",
    "correo_corporativo": "jperez@ejemplo.com",
    "evaluador": "Calidad",
    "tipo_consulta": "Afiliación"
  },
  "criterios": {
    "saludo": { "resultado": "Cumple", "evidencia": "Buenos días, le saluda Juan de Cofrem" },
    "empatia": { "resultado": "Cumple", "evidencia": "Entiendo su preocupación, con gusto le ayudo" },
    "sonrisa": { "resultado": "Cumple" },
    "claridad": { "resultado": "Cumple" },
    "encuesta": { "resultado": "No aplica" },
    "informacion": { "resultado": "Cumple" },
    "proceso": { "resultado": "Cumple" },
    "cierre": { "resultado": "Cumple" }
  },
  "puntaje_tuteo": "Sin tuteo",
  "observacion": "El usuario consultó el estado de su afiliación; se verificó y confirmó activa.",
  "hallazgos": "Te presentaste completo y resolviste con claridad.",
  "puntos_mejora": "Mantén el cierre invitando a la encuesta cuando aplique.",
  "nota_propuesta": 100,
  "clasificacion_propuesta": "OK"
}
```

Resultado: válido → **Nota 100 % OK** (1 criterio en "No aplica" se excluye; 0 incumplimientos).

---

## 6. Ejemplo inválido (y por qué)

```json
{
  "formato": "AUDITORIA_CO_V1",
  "interaccion": { "asesor": "J.PEREZ123", "fecha": "2026-13-40" },
  "criterios": {
    "saludo": { "resultado": "Más o menos" },
    "amabilidad": { "resultado": "Cumple" }
  }
}
```

Errores detectados:
- `fecha` → `fecha_invalida` (no existe el mes 13 ni el día 40).
- `id_gestion` → `obligatorio_ausente`.
- `criterios.saludo` → `valor_no_permitido` (`"Más o menos"` no está permitido).
- `criterios.amabilidad` → `criterio_desconocido`.
- Faltan los demás criterios → `obligatorio_ausente` por cada uno.

El guardado queda **deshabilitado** hasta corregir los errores; los datos pegados se
conservan.

---

## 7. Prompt universal (botón «Copiar prompt universal»)

El prompt completo y autónomo lo genera `construirPromptUniversal()` en
[`src/lib/auditoria-chatgpt-contrato.ts`](../src/lib/auditoria-chatgpt-contrato.ts) a partir de
las constantes del contrato (formato, versión, claves de criterio y valores permitidos), para
que **texto y esquema no se desincronicen**. El botón de la pantalla de importación lo copia al
portapapeles sin alterar el JSON pegado ni la selección de asesor/ID/fecha.

El prompt instruye a ChatGPT para: actuar como auditor de calidad de COFREM; manejar errores de
transcripción de **AWS** (interpretar por contexto, no penalizar deformaciones, no inventar
evidencias); evaluar los 8 criterios con las claves y valores exactos; **no inventar** datos
administrativos (código, nombre, correo, canal, ID, fecha — los resuelve Du Site); y devolver un
único JSON `AUDITORIA_CO_V1` sin texto adicional. La nota/clasificación son informativas.

### Origen de las definiciones de criterio y limitación
Las definiciones sustantivas de cada criterio (qué significa "Cumple" en Saludo, Empatía, etc.)
se tomaron del **auditor con IA ya en producción** (`promptCriterios` en
[`src/lib/auditorias-admin.ts`](../src/lib/auditorias-admin.ts)); son las reglas de calidad
documentadas y respaldadas por el proyecto hoy. **Limitación:** no se localizó un documento de
rúbrica oficial de COFREM independiente del código. Si existe uno distinto, debe confirmarse y, de
diferir, actualizar tanto el auditor con IA como este prompt. Hasta esa confirmación, estas
definiciones son las vigentes en el repositorio, no una rúbrica externa verificada.

---

## 8. Limitación conocida — procedencia de la auditoría

El esquema actual de `Consolidado` **no tiene una columna de "procedencia/origen"** (IA /
CO / ChatGPT). La modalidad Auditoría ChatGPT se identifica **en la interfaz**, pero al
persistir reutiliza el mismo registro que la auditoría manual (CO), sin diferenciarse en la
hoja. No se reutiliza ningún campo existente (p. ej. `evaluador`) con un significado distinto,
y no se modifican columnas de producción por iniciativa propia.

**Solución mínima propuesta (requiere autorización):** agregar una columna nueva
`Procedencia` al final de `Consolidado` y escribir `"ChatGPT"` / `"CO"` / `"IA"`. Es
aditiva y no afecta el histórico ni los reportes actuales, pero implica un cambio de esquema
y por eso queda **pendiente de aprobación**.
