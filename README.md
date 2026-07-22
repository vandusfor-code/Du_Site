# Portal de Gestión

Portal único (Next.js) que reemplaza los Apps Script sueltos: Métricas, PQRSF DATA, Línea Amiga, Radicaciones y Quiz. Login con usuario/contraseña, pantalla de bienvenida y selector de módulos según los permisos de cada asesor.

## Estructura

- `src/app/login` — pantalla de login
- `src/app/page.tsx` — bienvenida + selector de módulos (protegida)
- `src/app/modulos/{metricas,pqrsf-data,linea-amiga,radicaciones,quiz}` — un módulo por carpeta (pendientes de migrar el código de cada Apps Script)
- `src/lib/sheets.ts` — cliente de Google Sheets (cuenta de servicio)
- `src/lib/usuarios.ts` — lectura de la hoja "Usuarios"
- `src/auth.ts` — configuración de NextAuth (Credentials)
- `src/proxy.ts` — protege todas las rutas excepto `/login`

## Configuración inicial

### 1. Cuenta de servicio de Google

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto (o usa uno existente) y habilita la **Google Sheets API**.
2. Crea una **cuenta de servicio** y genera una clave JSON.
3. Copia `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `private_key` → `GOOGLE_PRIVATE_KEY` en tu `.env.local`.

### 2. Hoja de cálculo "Usuarios"

Crea (o reutiliza) una hoja de Google Sheets con una pestaña llamada **Usuarios** y estas columnas desde `A2`:

| A (usuario) | B (password_hash) | C (nombre) | D (modulos) | E (activo) |
|---|---|---|---|---|
| jperez | $2a$10$... | Juan Pérez | metricas,pqrsf-data | SI |

- `modulos`: ids separados por coma, entre `metricas`, `pqrsf-data`, `linea-amiga`, `radicaciones`, `quiz` (DuAcademy).
- `activo`: `SI` o `NO`.

Comparte esa hoja con el correo de la cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) como **Editor**, y copia el ID de la hoja (parte de la URL) en `SHEET_ID_USUARIOS`.

Para generar el hash de una contraseña:

```bash
node scripts/generar-hash.mjs "laContraseñaDelAsesor"
```

### 3. Módulo Métricas

Ya migrado (`src/app/modulos/metricas`). Usa una hoja de cálculo aparte (la misma que ya tenías en Apps Script), con las pestañas: `TO`, `Desempeño`, `Consolidado`, `Historial_bonos`, `Compromisos`. Compártela también con la cuenta de servicio como Editor y copia su ID en `SHEET_ID_METRICAS`.

**Importante:** este módulo busca las métricas de cada asesor por el valor de la columna A de `TO`/`Desempeño`/`Consolidado` (ej. `ANAMARIA.MAHECHA`). Para que un asesor vea sus datos, el valor de la columna **usuario** en la hoja "Usuarios" (la del login) debe coincidir exactamente (sin distinguir mayúsculas) con ese identificador. Si tus asesores inician sesión con un usuario distinto (ej. `jperez`), no van a encontrar sus métricas — o unificas el formato de usuario, o le agregamos un mapeo aparte (avísame si es el caso).

La pestaña "Funcionarios" y las funciones `login()`/`obtenerUsuarios()` del Apps Script original ya no se usan: ese login propio fue reemplazado por el login único del portal.

### 4. Módulo PQRSF DATA (People Academy Pro)

Ya migrado (`src/app/modulos/pqrsf-data`). Usa su propia hoja de cálculo, con las pestañas: `DATA`, `CASOS`, `GENERAL` y `Registros` (donde queda el log de cada consulta: fecha, usuario, texto). Compártela con la cuenta de servicio como Editor y copia su ID en `SHEET_ID_PQRSF_DATA`.

Este módulo llama a la API de OpenAI (`gpt-3.5-turbo`) para clasificar/responder cada consulta. Necesitas una API Key propia en [platform.openai.com](https://platform.openai.com/api-keys) → `OPENAI_API_KEY`. **Este uso tiene costo** por cada búsqueda que hagan los asesores (facturado por OpenAI).

La hoja "Usuarios" y las funciones `loginUser()`/`obtenerUsuarios()` del Apps Script original ya no se usan (login propio reemplazado por el del portal). A diferencia de Métricas, aquí el nombre de usuario no necesita coincidir con nada externo: solo se guarda como referencia en la hoja "Registros".

> Nota: este módulo se llamaba "PQRS - Línea Amiga" en una versión anterior de este documento. Se renombró a **PQRSF DATA** porque "Línea Amiga" es en realidad otro módulo aparte (ver abajo).

### 5. Módulo Radicaciones

Ya migrado (`src/app/modulos/radicaciones`). Usa su propia hoja de cálculo, con las pestañas: `ASESORES` (columna E = nombre, usado solo para el selector de destinatario del chat), `GESTIONES` (radicados), `NOTIFICACIONES`, `CHAT` y `Turnos` (horarios para el widget de turno/WFM). Compártela con la cuenta de servicio como Editor y copia su ID en `SHEET_ID_RADICACIONES`.

**Importante — coincidencia de nombres:** este módulo identifica al asesor por su **nombre** (`session.user.nombre` de la hoja "Usuarios" del login), y lo compara contra la columna correspondiente en `GESTIONES`, `NOTIFICACIONES`, `CHAT` y `Turnos`. En `Turnos` específicamente la comparación es **exacta** (mayúsculas/tildes incluidas, tal como estaba en el Apps Script original) — si el nombre no coincide carácter por carácter, el widget de turno no mostrará nada. Asegúrate de que el campo "nombre" de cada asesor en la hoja "Usuarios" esté escrito exactamente igual que en `Turnos`.

Este módulo incluye chat interno y notificaciones con sondeo en vivo (cada 4s y 10s respectivamente) y alertas de horario con sonido — se comportan igual que en la app original, ahora sobre server actions en vez de `google.script.run`.

Al portar la lógica de horarios (que decide cuándo avisar "5 minutos para tu almuerzo", etc.) corregí un bug de zona horaria: el Apps Script original construía las horas del turno usando la hora del servidor de Google (que coincide con tu huso horario de cuenta), pero un servidor de Vercel corre en UTC — si no ajustaba esto explícitamente a America/Bogotá, las alertas habrían sonado 5 horas antes o después de lo esperado.

La pestaña "ASESORES" (columna con usuario+contraseña) y las funciones `login()`/`obtenerUsuarios()` originales ya no se usan para autenticar — solo se reutiliza la lista de nombres para el selector de chat.

### 6. Módulo Línea Amiga

Ya migrado (`src/app/modulos/linea-amiga`). Usa su propia hoja de cálculo, con las pestañas: `PQRSF Creados`, `USUARIOS` (columna B = nombre, para el listado de agentes), `CHAT`, `Notificaciones` y `Turnos`. Compártela con la cuenta de servicio como Editor y copia su ID en `SHEET_ID_LINEA_AMIGA`.

El panel de "Sugerencias" (búsqueda de casos similares por descripción) consulta una **hoja externa distinta** — cópiala en `SHEET_ID_SUGERENCIAS_PQRSF` y compártela también con la cuenta de servicio (al menos como Lector). El botón "Abrir base completa" del panel enlaza directamente a esa hoja en Google Sheets.

**Importante — coincidencia de nombres:** igual que en Radicaciones, este módulo identifica al agente por su **nombre** (`session.user.nombre`), comparado (sin distinguir mayúsculas/tildes) contra `PQRSF Creados`, `CHAT`, `Notificaciones` y `Turnos`.

Igual que en Radicaciones, corregí el mismo tipo de bug de zona horaria al portar `verificarHorarios()`: el cálculo de "faltan 2 minutos para tu almuerzo" ahora se hace explícitamente en hora de Bogotá en vez de depender de la zona horaria del servidor.

La hoja "USUARIOS" (con contraseñas) y el login propio del Apps Script original ya no se usan para autenticar — solo se reutiliza el listado de nombres para mostrarlos en el dropdown de agentes (aunque ese dropdown de login ya no existe, la función se conserva por si luego se necesita en otro lugar).

### 7. Módulo DuAcademy (id `quiz`)

Ya migrado (`src/app/modulos/quiz`). Es el módulo más grande: cursos con examen, simulaciones de rol con IA (chat), panel de administración y correos de recordatorio. Usa su propia hoja de cálculo, con las pestañas: `USUARIOS`, `CURSOS`, `SIMULACIONES`, `EXAMENES`, `PROGRESO`, `BASE-CONOCIMIENTO`. Compártela con la cuenta de servicio como Editor y copia su ID en `SHEET_ID_QUIZ`.

**Este módulo funciona distinto a los demás: tiene dos roles (asesor/admin) definidos en su propia hoja `USUARIOS`.**

- Identifica al usuario por **correo electrónico** (columna C de `USUARIOS`), no por nombre. Para que un asesor entre a DuAcademy, el valor de la columna **usuario** en la hoja "Usuarios" del login del portal debe coincidir exactamente (sin distinguir mayúsculas) con su email en la columna C de `USUARIOS` de esta hoja. Si no hay coincidencia, ve un mensaje de "no se encontró tu perfil" en vez de la plataforma.
- El **rol** (columna E: `asesor` o `Admin`) determina si ve el panel de cursos/simulaciones o el panel de administración — esto se verifica también del lado del servidor (no solo se oculta en la interfaz), así que un asesor no puede invocar las acciones de admin aunque manipule el navegador.
- Comparte la misma `OPENAI_API_KEY` que el módulo PQRSF DATA (ambos ahora usan una sola cuenta de OpenAI; antes eran dos proyectos de Apps Script independientes, posiblemente con keys distintas — si quieres mantenerlas separadas, dímelo y lo ajusto).

**Correos de recordatorio ("Notificar a Todos" en el panel admin):** el Apps Script original usaba `MailApp` de Google, que no existe fuera de Apps Script. Implementé el envío vía SMTP (paquete `nodemailer`) — configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM` en tus variables de entorno (con Gmail: `smtp.gmail.com`, puerto `587`, y una ["contraseña de aplicación"](https://myaccount.google.com/apppasswords) en vez de tu contraseña normal). Sin esas variables, el botón mostrará un error claro en vez de fallar en silencio. También define `APP_URL` (la URL pública de tu portal) para que el botón del correo enlace al lugar correcto.

> Nota de seguridad sobre `nodemailer`: la versión instalada (8.x) tiene una vulnerabilidad conocida relacionada con la opción `raw` de `sendMail`, que este proyecto nunca usa (solo enviamos `from/to/subject/html`). Se mantiene en 8.x porque es la versión compatible con las dependencias opcionales de NextAuth; si prefieres forzar la versión más nueva, se puede hacer, pero puede requerir ajustes en la resolución de dependencias.

### 8. Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores. `AUTH_SECRET` se genera con:

```bash
npx auth secret
```

### 9. Ejecutar en local

```bash
npm install
npm run dev
```

## Próximos pasos

Los 5 módulos ya están migrados. Lo que falta es desplegar en Vercel y conectar el dominio (ver sección de Despliegue).

## Despliegue

Pendiente: conectar el repositorio a Vercel, configurar las variables de entorno de producción y apuntar el dominio de GoDaddy (registros DNS) al proyecto de Vercel.
