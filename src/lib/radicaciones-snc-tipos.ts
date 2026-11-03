// Lógica pura y testeable de Salidas No Conformes (SNC) del módulo Radicaciones.
// Sin "server-only" para poder importarla en el cliente Y ejecutarla con el
// runner nativo de Node (node --test, solo sintaxis borrable).

export type EstadoSNC = "Pendiente" | "Solucionada";

export type SlaSNC = "a_tiempo" | "vence_hoy" | "vencida";

export interface SNCItem {
  fila: number; // fila real en la hoja (1-based), para actualizar
  fechaRegistro: string; // "dd/MM/yyyy HH:mm" para mostrar
  fechaRegistroYMD: string; // "yyyy-MM-dd" (Bogotá) para el cálculo de plazo
  asesora: string;
  radicado: string;
  motivo: string;
  estado: EstadoSNC;
  fechaSolucion: string; // "dd/MM/yyyy HH:mm" o ""
  detalle: string;
  registradoPor: string; // quién la creó (vacío = la propia asesora)
  diasHabiles: number; // hábiles transcurridos desde el registro (solo pendientes)
  diasRestantes: number; // 2 - diasHabiles, mínimo 0
  sla: SlaSNC; // semáforo del plazo
}

// Plazo de gestión de una SNC, en días hábiles.
export const PLAZO_HABILES_SNC = 2;

function esFinDeSemana(ms: number): boolean {
  const d = new Date(ms).getUTCDay();
  return d === 0 || d === 6; // domingo o sábado
}

function ymdAUtc(ymd: string): number | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Días hábiles (lun–vie) transcurridos DESDE el día siguiente al registro hasta
// hoy inclusive. Registrada hoy → 0; siguiente día hábil → 1; etc. El fin de
// semana no cuenta. Ambas fechas son "yyyy-MM-dd" en horario de Bogotá.
export function diasHabilesTranscurridos(fechaRegistroYMD: string, hoyYMD: string): number {
  const inicio = ymdAUtc(fechaRegistroYMD);
  const fin = ymdAUtc(hoyYMD);
  if (inicio === null || fin === null || fin <= inicio) return 0;
  let cuenta = 0;
  for (let ms = inicio + 86400000; ms <= fin; ms += 86400000) {
    if (!esFinDeSemana(ms)) cuenta++;
  }
  return cuenta;
}

// Semáforo del plazo según los días hábiles transcurridos.
// < 2 → a tiempo; = 2 → vence hoy; > 2 → vencida.
export function evaluarSla(diasHabiles: number): SlaSNC {
  if (diasHabiles > PLAZO_HABILES_SNC) return "vencida";
  if (diasHabiles === PLAZO_HABILES_SNC) return "vence_hoy";
  return "a_tiempo";
}

export function diasRestantes(diasHabiles: number): number {
  return Math.max(0, PLAZO_HABILES_SNC - diasHabiles);
}

export function normalizarEstadoSNC(valor: unknown): EstadoSNC {
  return (valor ?? "").toString().trim().toLowerCase().startsWith("soluc") ? "Solucionada" : "Pendiente";
}
