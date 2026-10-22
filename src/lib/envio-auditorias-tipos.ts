// ============================================================
// Envío de auditorías por asesora — tipos + lógica PURA (cliente-segura).
//
// Sin "server-only", sin red: solo transforma datos ya leídos (Consolidado +
// Funcionarios + estados de ciclo_auditoria) en la vista agrupada por asesora.
// Se prueba con `node --test` (runtime TS nativo) sin dependencias ni mocks de
// red. La identidad del asesor (código, nombre, correo, canal) proviene SIEMPRE
// del directorio oficial; nunca del JSON de ChatGPT ni del navegador.
//
// Sintaxis erasable-only a propósito (sin enums/namespaces) para el runtime de
// pruebas de Node.
// ============================================================

// Estados reales del ciclo (ver EstadoCiclo en gestion-calidad.ts). Se replican
// como unión de strings para no importar módulos server-only desde aquí.
export type EstadoCicloEnvio =
  | "CREADA"
  | "NOTIFICADA"
  | "ACUSADA"
  | "COMPROMISO_PENDIENTE"
  | "EN_SEGUIMIENTO"
  | "CERRADA"
  | "NO_ELEGIBLE"
  | "SIN_CICLO"; // no existe fila en ciclo_auditoria todavía (adopción no corrida)

// Una auditoría de Consolidado, ya reducida a lo que el envío necesita. `fecha`
// es la FECHA DE REGISTRO de la auditoría (Consolidado!A), en "YYYY-MM-DD"
// (hora Bogotá) — no la fecha de llamada ni la de modificación.
export interface AuditoriaFilaEnvio {
  idGestion: string;
  asesorCodigo: string; // Consolidado!C (código, mayúsculas)
  fecha: string; // "YYYY-MM-DD" (registro)
  canalConsolidado: string;
  resultado: string; // "OK" | "PENC" (Tipo Nota)
}

// Estado del ciclo por idGestion (de Supabase), más si requiere compromiso.
export interface EstadoCicloPorId {
  estado: EstadoCicloEnvio;
  requiereCompromiso: boolean;
}

export interface RegistroDirectorio {
  nombre: string;
  correo: string;
  canal: string;
}

export interface FiltrosEnvio {
  fecha: string; // "YYYY-MM-DD" obligatoria
  asesora?: string; // código específico o vacío = todas
  soloPendientes?: boolean; // true = solo las pendientes de envío
}

// Una auditoría dentro de un grupo, con su estado individual de ciclo.
export interface AuditoriaEnGrupo {
  idGestion: string;
  resultado: string;
  estadoCiclo: EstadoCicloEnvio;
  requiereCompromiso: boolean;
  pendienteEnvio: boolean; // CREADA (adoptada, aún no notificada)
  enviada: boolean; // NOTIFICADA o posterior
  elegible: boolean; // tiene ciclo CREADA + correo oficial válido
}

export interface GrupoAsesora {
  asesorCodigo: string;
  nombre: string; // oficial (directorio) o el código si no está
  correo: string; // oficial (directorio); "" si falta
  enDirectorio: boolean;
  total: number;
  pendientes: number; // pendientes de envío (CREADA)
  enviadas: number; // ya notificadas o posterior
  noElegibles: number; // sin ciclo, NO_ELEGIBLE o sin correo oficial
  idsPendientesElegibles: string[]; // los que un envío realmente tomaría
  estadoNotificacion: string; // etiqueta resumida
  auditorias: AuditoriaEnGrupo[];
}

export interface ResumenEnvio {
  fecha: string;
  totalAuditorias: number;
  totalAsesoras: number;
  totalPendientes: number;
  totalEnviadas: number;
  totalNoElegibles: number;
  grupos: GrupoAsesora[];
}

const ESTADOS_ENVIADA = new Set<EstadoCicloEnvio>([
  "NOTIFICADA",
  "ACUSADA",
  "COMPROMISO_PENDIENTE",
  "EN_SEGUIMIENTO",
  "CERRADA",
]);

function etiquetaNotificacion(pendientes: number, enviadas: number, noElegibles: number): string {
  if (pendientes === 0 && enviadas > 0 && noElegibles === 0) return "Todas enviadas";
  if (pendientes > 0 && enviadas > 0) return "Envío parcial";
  if (pendientes > 0) return "Pendiente de envío";
  if (noElegibles > 0 && enviadas === 0 && pendientes === 0) return "Sin auditorías elegibles";
  return "—";
}

/**
 * Agrupa por asesora las auditorías de la fecha indicada, resolviendo identidad
 * oficial desde el directorio y el estado individual desde los ciclos. Pura.
 */
export function agruparAuditorias(
  filas: AuditoriaFilaEnvio[],
  ciclos: Map<string, EstadoCicloPorId>,
  directorio: Map<string, RegistroDirectorio>,
  filtros: FiltrosEnvio
): ResumenEnvio {
  const fecha = (filtros.fecha ?? "").trim();
  const asesoraFiltro = (filtros.asesora ?? "").trim().toUpperCase();

  const porAsesora = new Map<string, AuditoriaEnGrupo[]>();

  for (const f of filas) {
    if (f.fecha !== fecha) continue; // fecha de REGISTRO exacta
    const codigo = (f.asesorCodigo ?? "").trim().toUpperCase();
    if (!codigo) continue;
    if (asesoraFiltro && codigo !== asesoraFiltro) continue;

    const ciclo = ciclos.get(f.idGestion);
    const estadoCiclo: EstadoCicloEnvio = ciclo?.estado ?? "SIN_CICLO";
    const reg = directorio.get(codigo);
    const correoOficial = (reg?.correo ?? "").trim();

    // "Pendiente de envío" = aún no notificada. Incluye SIN_CICLO: una auditoría
    // recién guardada todavía no tiene fila de ciclo; el ciclo se crea al enviar
    // (adopción). Así aparece de inmediato tras guardarla, sin un paso manual.
    const pendienteEnvio = estadoCiclo === "CREADA" || estadoCiclo === "SIN_CICLO";
    const enviada = ESTADOS_ENVIADA.has(estadoCiclo);
    const elegible = pendienteEnvio && !!correoOficial;

    const item: AuditoriaEnGrupo = {
      idGestion: f.idGestion,
      resultado: f.resultado,
      estadoCiclo,
      requiereCompromiso: ciclo?.requiereCompromiso ?? false,
      pendienteEnvio,
      enviada,
      elegible,
    };
    if (!porAsesora.has(codigo)) porAsesora.set(codigo, []);
    porAsesora.get(codigo)!.push(item);
  }

  const grupos: GrupoAsesora[] = [];
  for (const [codigo, auditorias] of porAsesora) {
    const reg = directorio.get(codigo);
    const pendientes = auditorias.filter((a) => a.pendienteEnvio).length;
    const enviadas = auditorias.filter((a) => a.enviada).length;
    const noElegibles = auditorias.filter((a) => !a.enviada && !a.elegible).length;
    const idsPendientesElegibles = auditorias.filter((a) => a.elegible).map((a) => a.idGestion);

    grupos.push({
      asesorCodigo: codigo,
      nombre: reg?.nombre?.trim() || codigo,
      correo: (reg?.correo ?? "").trim(),
      enDirectorio: !!reg,
      total: auditorias.length,
      pendientes,
      enviadas,
      noElegibles,
      idsPendientesElegibles,
      estadoNotificacion: etiquetaNotificacion(pendientes, enviadas, noElegibles),
      auditorias,
    });
  }

  // Orden: primero las que tienen pendientes elegibles, luego por nombre.
  grupos.sort((a, b) => {
    const pa = a.idsPendientesElegibles.length > 0 ? 0 : 1;
    const pb = b.idsPendientesElegibles.length > 0 ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.nombre.localeCompare(b.nombre);
  });

  const gruposFiltrados = filtros.soloPendientes
    ? grupos.filter((g) => g.pendientes > 0)
    : grupos;

  const totalAuditorias = gruposFiltrados.reduce((s, g) => s + g.total, 0);
  const totalPendientes = gruposFiltrados.reduce((s, g) => s + g.pendientes, 0);
  const totalEnviadas = gruposFiltrados.reduce((s, g) => s + g.enviadas, 0);
  const totalNoElegibles = gruposFiltrados.reduce((s, g) => s + g.noElegibles, 0);

  return {
    fecha,
    totalAuditorias,
    totalAsesoras: gruposFiltrados.length,
    totalPendientes,
    totalEnviadas,
    totalNoElegibles,
    grupos: gruposFiltrados,
  };
}

// Transiciones válidas del ciclo (para validar acuse/compromiso server-side).
// Refleja el modelo real (CREADA→NOTIFICADA→(ACUSADA|COMPROMISO_PENDIENTE)→
// EN_SEGUIMIENTO→CERRADA). NO_ELEGIBLE es terminal de adopción.
export const TRANSICIONES_VALIDAS: Record<string, EstadoCicloEnvio[]> = {
  CREADA: ["NOTIFICADA", "NO_ELEGIBLE"],
  NOTIFICADA: ["ACUSADA", "COMPROMISO_PENDIENTE"],
  ACUSADA: ["CERRADA"],
  COMPROMISO_PENDIENTE: ["EN_SEGUIMIENTO"],
  EN_SEGUIMIENTO: ["CERRADA"],
  CERRADA: [],
  NO_ELEGIBLE: [],
  SIN_CICLO: [],
};

export function transicionValida(desde: EstadoCicloEnvio, hacia: EstadoCicloEnvio): boolean {
  return (TRANSICIONES_VALIDAS[desde] ?? []).includes(hacia);
}

// Estado al que lleva un ACUSE según si la auditoría requiere compromiso:
// con compromiso → COMPROMISO_PENDIENTE; sin compromiso → ACUSADA.
export function estadoTrasAcuse(requiereCompromiso: boolean): EstadoCicloEnvio {
  return requiereCompromiso ? "COMPROMISO_PENDIENTE" : "ACUSADA";
}
