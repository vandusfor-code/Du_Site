// Tipos y helpers puros de Puntos de pago. Compartidos entre servidor y cliente.
// Sin "server-only": el dashboard filtra en el cliente sobre el arreglo ya cargado.
// La fuente (mock hoy, Supabase después) vive en puntos-pago.ts.

export interface PuntoPago {
  id: string;
  red: string;
  departamento: string;
  ciudad: string;
  nombre: string;
  direccion: string;
  horario: string | null;
  latitud: number | null;
  longitud: number | null;
}

export interface FiltrosPuntosPago {
  q: string;
  departamento: string;
  ciudad: string;
  red: string;
}

export type OrdenPuntosPago = "nombre-asc" | "nombre-desc";

export const FILAS_POR_PAGINA = 10;

/** Quita tildes y unifica mayúsculas para búsquedas tolerantes. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function hayConsultaActiva(filtros: FiltrosPuntosPago): boolean {
  return (
    normalizarTexto(filtros.q).length > 0 ||
    filtros.departamento !== "Todos" ||
    filtros.ciudad !== "Todos" ||
    filtros.red !== "Todas"
  );
}

function coincideTexto(punto: PuntoPago, q: string): boolean {
  if (!q) return true;
  const haystack = normalizarTexto(
    `${punto.nombre} ${punto.direccion} ${punto.ciudad} ${punto.departamento} ${punto.red}`
  );
  return haystack.includes(q);
}

export function filtrarPuntos(puntos: PuntoPago[], filtros: FiltrosPuntosPago): PuntoPago[] {
  const q = normalizarTexto(filtros.q);
  return puntos.filter((p) => {
    const textoOk = coincideTexto(p, q);
    const deptoOk = filtros.departamento === "Todos" || p.departamento === filtros.departamento;
    const ciudadOk = filtros.ciudad === "Todos" || p.ciudad === filtros.ciudad;
    const redOk = filtros.red === "Todas" || p.red === filtros.red;
    return textoOk && deptoOk && ciudadOk && redOk;
  });
}

export function ordenarPuntos(puntos: PuntoPago[], orden: OrdenPuntosPago): PuntoPago[] {
  const dir = orden === "nombre-asc" ? 1 : -1;
  return [...puntos].sort((a, b) => dir * a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}

export function departamentosDe(puntos: PuntoPago[]): string[] {
  return Array.from(new Set(puntos.map((p) => p.departamento))).sort((a, b) => a.localeCompare(b, "es"));
}

export function ciudadesDe(puntos: PuntoPago[], departamento: string): string[] {
  const fuente = departamento === "Todos" ? puntos : puntos.filter((p) => p.departamento === departamento);
  return Array.from(new Set(fuente.map((p) => p.ciudad))).sort((a, b) => a.localeCompare(b, "es"));
}

export function redesDe(puntos: PuntoPago[]): string[] {
  return Array.from(new Set(puntos.map((p) => p.red))).sort((a, b) => a.localeCompare(b, "es"));
}

/** Etiqueta contextual del resumen: "Barranquilla, Atlántico" cuando todos coinciden. */
export function etiquetaContexto(puntos: PuntoPago[], filtros: FiltrosPuntosPago): string {
  if (puntos.length === 0) return filtros.q.trim() || "Sin coincidencias";

  const claves = new Set(puntos.map((p) => `${p.ciudad}|${p.departamento}`));
  if (claves.size === 1) {
    const [ciudad, departamento] = [...claves][0].split("|");
    return `${ciudad}, ${departamento}`;
  }

  const deptos = new Set(puntos.map((p) => p.departamento));
  if (deptos.size === 1) return [...deptos][0];

  const q = filtros.q.trim();
  if (q) return q;
  return "Varios municipios";
}

export function urlComoLlegar(punto: PuntoPago): string | null {
  if (punto.latitud != null && punto.longitud != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${punto.latitud},${punto.longitud}`;
  }
  const query = `${punto.direccion}, ${punto.ciudad}, ${punto.departamento}, Colombia`;
  if (!punto.direccion.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function textoParaCompartir(punto: PuntoPago): string {
  return `${punto.nombre} — ${punto.direccion}, ${punto.ciudad}, ${punto.departamento} (${punto.red})`;
}

export function paginasVisibles(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (actual <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (actual >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", actual - 1, actual, actual + 1, "…", total];
}
