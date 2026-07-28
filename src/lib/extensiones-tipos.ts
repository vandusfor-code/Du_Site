// Tipos y funciones puras de Extensiones, compartidos entre servidor y cliente.
// (Sin "server-only": este archivo también se importa desde el componente cliente.)

export interface ExtensionRegistro {
  id: string;
  extension: string;
  nombre: string;
  cargo: string;
  area: string;
  horario: string[];
}

export interface ExtensionesData {
  registros: ExtensionRegistro[];
  /** true cuando los datos vienen de la hoja real (SHEET_ID_EXTENSIONES). */
  conectado: boolean;
}

export interface ExtensionGrupo {
  extension: string;
  area: string;
  horario: string[];
  personas: { nombre: string; cargo: string }[];
  estado: "activa" | "inactiva";
  uso: "en_uso" | "disponible";
}

// La hoja no trae columnas de Estado/Uso, pero sí escribe el motivo directamente
// en NOMBRE cuando una extensión no tiene a alguien asignado en este momento
// (ej. "DESCONECTADO X VACACIONES"). Se lee ese texto real en vez de inventar
// una regla aparte — nunca se asume "activa"/"en uso" sobre datos que no existen.
const PATRON_SIN_PERSONA = /desconectad|vacante|sin asignar|por asignar/i;
const PATRON_BAJA = /de baja|eliminad|no usar|fuera de servicio/i;

function esPersonaAsignada(nombre: string): boolean {
  const n = nombre.trim();
  return n.length > 0 && !PATRON_SIN_PERSONA.test(n);
}

// Una misma extensión puede repetirse en varias filas (varias personas);
// se agrupan en una sola fila de tabla con los nombres apilados.
export function agruparPorExtension(registros: ExtensionRegistro[]): ExtensionGrupo[] {
  const grupos = new Map<string, { extension: string; area: string; horario: string[]; personas: { nombre: string; cargo: string }[] }>();
  for (const r of registros) {
    let g = grupos.get(r.extension);
    if (!g) {
      g = { extension: r.extension, area: r.area, horario: r.horario, personas: [] };
      grupos.set(r.extension, g);
    }
    if (r.nombre || r.cargo) g.personas.push({ nombre: r.nombre, cargo: r.cargo });
  }

  return Array.from(grupos.values()).map((g) => {
    const hayAsignado = g.personas.some((p) => esPersonaAsignada(p.nombre));
    const hayBaja = g.personas.length > 0 && g.personas.every((p) => PATRON_BAJA.test(p.nombre));
    return {
      ...g,
      uso: hayAsignado ? "en_uso" : "disponible",
      estado: hayBaja ? "inactiva" : "activa",
    };
  });
}

export interface KpisExtensiones {
  total: number;
  activas: number;
  enUso: number;
  disponibles: number;
  inactivas: number;
}

export function calcularKpis(grupos: ExtensionGrupo[]): KpisExtensiones {
  return {
    total: grupos.length,
    activas: grupos.filter((g) => g.estado === "activa").length,
    inactivas: grupos.filter((g) => g.estado === "inactiva").length,
    enUso: grupos.filter((g) => g.uso === "en_uso").length,
    disponibles: grupos.filter((g) => g.uso === "disponible").length,
  };
}
