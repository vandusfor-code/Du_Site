// ============================================================
// Calculadora de días hábiles para Colombia — FUNCIÓN PURA a propósito
// (sin I/O, sin "server-only", sin imports de Next): mismos argumentos,
// mismo resultado siempre. Se puede probar con node plano, sin tocar
// Sheets ni Supabase — mismo criterio que identidad-ciclo.ts.
//
// Reutilizada por fecha_prometida y por los tres relojes de recordatorios
// (ver diseño del módulo Calidad, secciones L y J) — una sola función,
// nunca una implementación por reloj.
//
// Festivos calculados ALGORÍTMICAMENTE, nunca desde una tabla mantenida a
// mano que se desactualizaría año a año:
//   - 6 fijos (misma fecha siempre).
//   - 7 de fecha fija pero trasladable al lunes siguiente (Ley Emiliani)
//     si no cae ya en lunes.
//   - 5 derivados del Domingo de Pascua (algoritmo de Computus, método
//     Meeus/Jones/Butcher — determinista, válido para el calendario
//     gregoriano, sin dependencias externas): Jueves y Viernes Santo NO
//     se trasladan; Ascensión, Corpus Christi y Sagrado Corazón sí.
// Total: 18 festivos/año.
// ============================================================

function fechaUTC(anio: number, mes1: number, dia: number): Date {
  // mes1: 1-12 (no 0-based), para que el código coincida con el calendario real.
  return new Date(Date.UTC(anio, mes1 - 1, dia));
}

function sumarDiasCalendario(fecha: Date, dias: number): Date {
  const r = new Date(fecha.getTime());
  r.setUTCDate(r.getUTCDate() + dias);
  return r;
}

function claveFecha(f: Date): string {
  return `${f.getUTCFullYear()}-${f.getUTCMonth()}-${f.getUTCDate()}`;
}

// Domingo de Pascua (calendario gregoriano) — algoritmo de Computus,
// método Meeus/Jones/Butcher.
function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUTC(anio, mes, dia);
}

// Ley Emiliani: si el festivo no cae ya en lunes, se traslada al lunes
// siguiente. Una sola regla, reutilizada en los 10 festivos trasladables
// (7 de fecha fija + Ascensión + Corpus Christi + Sagrado Corazón) — nunca
// 10 casos especiales distintos.
function trasladarALunesSiNoLoEs(fecha: Date): Date {
  const diaSemana = fecha.getUTCDay(); // 0=domingo … 1=lunes … 6=sábado
  if (diaSemana === 1) return fecha;
  const diasHastaLunes = ((8 - diaSemana) % 7) || 7;
  return sumarDiasCalendario(fecha, diasHastaLunes);
}

export function festivosColombia(anio: number): Date[] {
  const pascua = domingoDePascua(anio);

  const fijos = [
    fechaUTC(anio, 1, 1), // Año Nuevo
    fechaUTC(anio, 5, 1), // Día del Trabajo
    fechaUTC(anio, 7, 20), // Independencia
    fechaUTC(anio, 8, 7), // Batalla de Boyacá
    fechaUTC(anio, 12, 8), // Inmaculada Concepción
    fechaUTC(anio, 12, 25), // Navidad
  ];

  const trasladablesFijos = [
    fechaUTC(anio, 1, 6), // Reyes Magos (Epifanía)
    fechaUTC(anio, 3, 19), // San José
    fechaUTC(anio, 6, 29), // San Pedro y San Pablo
    fechaUTC(anio, 8, 15), // Asunción de la Virgen
    fechaUTC(anio, 10, 12), // Día de la Raza
    fechaUTC(anio, 11, 1), // Todos los Santos
    fechaUTC(anio, 11, 11), // Independencia de Cartagena
  ].map(trasladarALunesSiNoLoEs);

  const juevesSanto = sumarDiasCalendario(pascua, -3); // no se traslada
  const viernesSanto = sumarDiasCalendario(pascua, -2); // no se traslada
  const ascension = trasladarALunesSiNoLoEs(sumarDiasCalendario(pascua, 39));
  const corpusChristi = trasladarALunesSiNoLoEs(sumarDiasCalendario(pascua, 60));
  const sagradoCorazon = trasladarALunesSiNoLoEs(sumarDiasCalendario(pascua, 68));

  return [
    ...fijos,
    ...trasladablesFijos,
    juevesSanto,
    viernesSanto,
    ascension,
    corpusChristi,
    sagradoCorazon,
  ];
}

// Cache por año: evita recalcular Computus en cada día iterado por
// sumarDiasHabiles(). Solo memoriza claves de fecha (strings), no fechas
// reales de negocio — no hay ningún estado mutable riesgoso aquí.
const cacheFestivosPorAnio = new Map<number, Set<string>>();
function festivosSetColombia(anio: number): Set<string> {
  let set = cacheFestivosPorAnio.get(anio);
  if (!set) {
    set = new Set(festivosColombia(anio).map(claveFecha));
    cacheFestivosPorAnio.set(anio, set);
  }
  return set;
}

function esFinDeSemana(fecha: Date): boolean {
  const d = fecha.getUTCDay();
  return d === 0 || d === 6;
}

export function esDiaHabilColombia(fecha: Date): boolean {
  if (esFinDeSemana(fecha)) return false;
  return !festivosSetColombia(fecha.getUTCFullYear()).has(claveFecha(fecha));
}

// Suma N días hábiles a partir de fechaBase. fechaBase es SIEMPRE "día 0" y
// NUNCA cuenta como parte del conteo, sea o no día hábil — mismo criterio
// para fecha_prometida y para los tres relojes de recordatorios (diseño,
// sección L.7). n=0 devuelve fechaBase sin cambios.
export function sumarDiasHabiles(fechaBase: Date, n: number): Date {
  let cursor = new Date(fechaBase.getTime());
  let contados = 0;
  while (contados < n) {
    cursor = sumarDiasCalendario(cursor, 1);
    if (esDiaHabilColombia(cursor)) contados++;
  }
  return cursor;
}
