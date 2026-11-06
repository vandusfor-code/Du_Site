// ============================================================
// MOTOR DE BONOS NATIVO (sin Excel)
// Reglas tomadas de la hoja "Tabla objetivos": por área, cada métrica tiene un
// UMBRAL mínimo de cumplimiento y un MONTO que aporta al bono si se cumple. El
// bono es la suma de los montos de las métricas que alcanzan su umbral. El tope
// por persona es $300.000 (la suma de todos los montos de su área).
//
// Esto reemplaza la fórmula del sheet:
//   =SI(E>=98%;60000;0)+SI(F>=100%;40000;0)+...
// pero calculado en Du Site, para no depender del Excel.
// ============================================================

import { AREAS_ORDEN, CAMPOS_EDITABLES_POR_AREA, type Area, type CampoDesempeno } from "@/lib/desempeno-tipos";

export const BASE_BONO = 300000;

export interface ReglaBono {
  campo: CampoDesempeno;
  /** Umbral mínimo en % (p. ej. 98 = 98%). Se cumple si valor >= umbral. */
  umbral: number;
  /** Monto en pesos que aporta al bono si se cumple el umbral. */
  monto: number;
  /** De dónde sale el valor: "auto" lo calcula la plataforma; "manual" lo captura el coordinador. */
  origen: "auto" | "manual";
}

// Montos por área (suman $300.000). Tomados de los pesos de "Tabla objetivos":
// 13,33%→$40k · 16,67%→$50k · 20%→$60k · 23,33%→$70k · 26,67%→$80k · 10%→$30k.
export const REGLAS_BONO: Record<Area, ReglaBono[]> = {
  "Línea amiga / Chat": [
    { campo: "satisfaccion", umbral: 95, monto: 40000, origen: "manual" },
    { campo: "pec", umbral: 98, monto: 70000, origen: "auto" },
    { campo: "penc", umbral: 95, monto: 50000, origen: "auto" },
    { campo: "productividad", umbral: 95, monto: 80000, origen: "auto" },
    { campo: "adherencia", umbral: 100, monto: 60000, origen: "manual" },
  ],
  "G. Empleo": [
    { campo: "satisfaccion", umbral: 95, monto: 40000, origen: "manual" },
    { campo: "pec", umbral: 98, monto: 70000, origen: "auto" },
    { campo: "penc", umbral: 95, monto: 50000, origen: "auto" },
    { campo: "productividad", umbral: 95, monto: 80000, origen: "auto" },
    { campo: "adherencia", umbral: 100, monto: 60000, origen: "manual" },
  ],
  "Encuestas": [
    { campo: "productividad", umbral: 98, monto: 50000, origen: "manual" },
    { campo: "precision", umbral: 98, monto: 30000, origen: "manual" },
    { campo: "adherencia", umbral: 100, monto: 50000, origen: "manual" },
    { campo: "calidadLlamada", umbral: 95, monto: 40000, origen: "manual" },
    { campo: "errorRespuesta", umbral: 98, monto: 50000, origen: "manual" },
    { campo: "pec", umbral: 98, monto: 40000, origen: "auto" },
    { campo: "penc", umbral: 95, monto: 40000, origen: "auto" },
  ],
  "Radicación": [
    { campo: "productividad", umbral: 98, monto: 60000, origen: "manual" },
    { campo: "radicadosPct", umbral: 100, monto: 40000, origen: "manual" },
    { campo: "snc", umbral: 95, monto: 80000, origen: "manual" },
    { campo: "precision", umbral: 98, monto: 60000, origen: "manual" },
    { campo: "adherencia", umbral: 100, monto: 60000, origen: "manual" },
  ],
  // G. Empleo Cofrem: en la hoja solo lleva PEC/PENC/Auditorías. Regla tentativa
  // (PEC 50% + PENC 50%); a confirmar con el usuario por resultado, no por fórmula.
  "G. Empleo Cofrem": [
    { campo: "pec", umbral: 98, monto: 150000, origen: "auto" },
    { campo: "penc", umbral: 95, monto: 150000, origen: "auto" },
  ],
};

// Reglas ESPECIALES por código de asesor (excepciones a las de su área). Joselyn
// (J.MENDOZA382) maneja Empleo + Radicación: su tabla combina llamadas (PEC/PENC
// auditadas) con radicación (RADICADOS/SNC de conteos). Suma $300.000; sin Precisión.
export const REGLAS_ESPECIALES: Record<string, ReglaBono[]> = {
  "J.MENDOZA382": [
    { campo: "satisfaccion", umbral: 95, monto: 40000, origen: "manual" },
    { campo: "pec", umbral: 98, monto: 70000, origen: "auto" },
    { campo: "penc", umbral: 95, monto: 50000, origen: "auto" },
    { campo: "radicadosPct", umbral: 95, monto: 40000, origen: "auto" },
    { campo: "adherencia", umbral: 100, monto: 60000, origen: "manual" },
    { campo: "snc", umbral: 95, monto: 40000, origen: "auto" },
  ],
};

// Reglas aplicables a un funcionario: las especiales de su código si existen,
// si no las de su área.
export function reglasDe(area: Area, codigo?: string): ReglaBono[] {
  const c = (codigo ?? "").trim().toUpperCase();
  return (c && REGLAS_ESPECIALES[c]) || REGLAS_BONO[area] || [];
}

// Métricas que se muestran/capturan para un funcionario (set especial por código
// si aplica, si no el de su área). Joselyn ve sus columnas combinadas.
export const CAMPOS_ESPECIALES: Record<string, CampoDesempeno[]> = {
  "J.MENDOZA382": [
    "satisfaccion", "pec", "penc", "radicadosPct", "snc", "adherencia",
    "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados",
  ],
};
export function camposEditablesDe(area: Area, codigo?: string): CampoDesempeno[] {
  const c = (codigo ?? "").trim().toUpperCase();
  return (c && CAMPOS_ESPECIALES[c]) || CAMPOS_EDITABLES_POR_AREA[area] || [];
}

export interface DetalleBonoItem {
  campo: CampoDesempeno;
  umbral: number;
  monto: number;
  origen: "auto" | "manual";
  /** Valor en % (o null si falta). */
  valor: number | null;
  cumple: boolean;
}

export interface ResultadoBono {
  total: number;
  topeMaximo: number;
  detalle: DetalleBonoItem[];
}

// Normaliza un valor de métrica ("98%", "98,5", 98) a número en escala 0-100.
export function normalizarPct(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : (v <= 1 ? v * 100 : v);
  const n = parseFloat(v.replace("%", "").replace(",", ".").trim());
  if (isNaN(n)) return null;
  return n <= 1 ? n * 100 : n; // acepta 0,98 o 98
}

// Calcula el bono de un funcionario a partir de sus valores de métricas.
// `codigo` permite aplicar reglas especiales (p.ej. Joselyn).
export function calcularBono(
  area: Area,
  valores: Partial<Record<CampoDesempeno, string | number>>,
  codigo?: string
): ResultadoBono {
  const reglas = reglasDe(area, codigo);
  const detalle: DetalleBonoItem[] = reglas.map((r) => {
    const valor = normalizarPct(valores[r.campo]);
    const cumple = valor !== null && valor >= r.umbral;
    return { campo: r.campo, umbral: r.umbral, monto: r.monto, origen: r.origen, valor, cumple };
  });
  const total = detalle.reduce((s, d) => s + (d.cumple ? d.monto : 0), 0);
  const topeMaximo = reglas.reduce((s, r) => s + r.monto, 0);
  return { total, topeMaximo, detalle };
}

// Campos que la plataforma calcula sola (auto) y que captura a mano (manual).
export function camposPorOrigen(area: Area, codigo?: string): { auto: CampoDesempeno[]; manual: CampoDesempeno[] } {
  const reglas = reglasDe(area, codigo);
  return {
    auto: reglas.filter((r) => r.origen === "auto").map((r) => r.campo),
    manual: reglas.filter((r) => r.origen === "manual").map((r) => r.campo),
  };
}

export { AREAS_ORDEN };
