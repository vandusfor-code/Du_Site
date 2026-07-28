// Tipos y funciones puras de Extensiones, compartidos entre servidor y cliente.
// (Sin "server-only": este archivo también se importa desde el componente cliente.)

export interface ExtensionRegistro {
  id: string;
  extension: string;
  nombre: string;
  cargo: string;
  area: string;
  horario: string[];
  estado?: "activa" | "inactiva";
  uso?: "en_uso" | "disponible";
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
  estado?: "activa" | "inactiva";
  uso?: "en_uso" | "disponible";
}

// Una misma extensión puede repetirse en varias filas (varias personas);
// se agrupan en una sola fila de tabla con los nombres apilados.
export function agruparPorExtension(registros: ExtensionRegistro[]): ExtensionGrupo[] {
  const grupos = new Map<string, ExtensionGrupo>();
  for (const r of registros) {
    let g = grupos.get(r.extension);
    if (!g) {
      g = { extension: r.extension, area: r.area, horario: r.horario, personas: [], estado: r.estado, uso: r.uso };
      grupos.set(r.extension, g);
    }
    if (r.nombre || r.cargo) g.personas.push({ nombre: r.nombre, cargo: r.cargo });
  }
  return Array.from(grupos.values());
}

export interface KpisExtensiones {
  total: number;
  activas: number | null;
  enUso: number | null;
  disponibles: number | null;
  inactivas: number | null;
}

// Solo se reportan Estado/Uso cuando TODOS los grupos traen el dato — nunca
// se infiere (p. ej. "sin nombre = disponible") sin una fuente real que lo confirme.
export function calcularKpis(grupos: ExtensionGrupo[]): KpisExtensiones {
  const total = grupos.length;
  const tieneEstado = total > 0 && grupos.every((g) => g.estado);
  const tieneUso = total > 0 && grupos.every((g) => g.uso);

  return {
    total,
    activas: tieneEstado ? grupos.filter((g) => g.estado === "activa").length : null,
    inactivas: tieneEstado ? grupos.filter((g) => g.estado === "inactiva").length : null,
    enUso: tieneUso ? grupos.filter((g) => g.uso === "en_uso").length : null,
    disponibles: tieneUso ? grupos.filter((g) => g.uso === "disponible").length : null,
  };
}
