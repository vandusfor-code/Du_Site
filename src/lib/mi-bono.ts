import "server-only";
import { obtenerBonoHistoricoAsesor, obtenerTodoHistorico } from "@/lib/bono-store";
import { calcularBono } from "@/lib/desempeno-bono";
import { LABELS, AREAS_ORDEN, type Area, type CampoDesempeno } from "@/lib/desempeno-tipos";

// ============================================================
// "Mi bono" — vista motivadora para la asesora. Lee del histórico de bonos
// (meses ya CERRADOS por el coordinador) la fila del asesor y arma el detalle
// del bono (qué métricas cumplió y cuánto aportó cada una). Si no hay ningún
// mes cerrado para ese código, devuelve null (no se muestra nada).
// ============================================================

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  return `${MESES_ES[parseInt(m[2], 10) - 1] ?? m[2]} ${m[1]}`;
}

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

// Frases motivadoras (se elige una al azar en cada apertura).
const FRASES = [
  "Gracias por tu compromiso y entrega. 💚",
  "Tu esfuerzo se nota y se premia. ¡Sigue brillando! ✨",
  "¡Felicitaciones! Tu dedicación hace la diferencia. 🌟",
  "Cada gestión tuya cuenta. ¡Gracias por tu excelente trabajo! 🙌",
  "Tu calidad y constancia tienen recompensa. ¡Bien hecho! 🎉",
  "Gracias por dar siempre lo mejor de ti. 💪",
];

export interface MiBonoDetalle {
  campo: CampoDesempeno;
  label: string;
  monto: number;
  montoLabel: string;
  cumple: boolean;
  valor: number | null;
}

export interface MiBono {
  mes: string;
  mesLabel: string;
  nombre: string;
  area: string;
  total: number;
  totalLabel: string;
  topeMaximo: number;
  topeLabel: string;
  porcentaje: number;
  detalle: MiBonoDetalle[];
  frase: string;
}

function esArea(v: string): v is Area {
  return (AREAS_ORDEN as readonly string[]).includes(v);
}

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Devuelve el bono del ÚLTIMO mes cerrado del asesor, o null. Cruza primero por
// CÓDIGO de login; si no hay (el login puede no coincidir con el código del
// bono), cae a cruzar por NOMBRE completo.
export async function obtenerMiBono(codigo: string, nombre?: string): Promise<MiBono | null> {
  let filas = await obtenerBonoHistoricoAsesor(codigo);
  if (filas.length === 0 && nombre) {
    const n = norm(nombre);
    if (n) {
      const todas = await obtenerTodoHistorico();
      filas = todas.filter((f) => {
        const fn = norm(f.nombre);
        return fn !== "" && (fn === n || fn.includes(n) || n.includes(fn));
      });
    }
  }
  if (filas.length === 0) return null;

  const row = filas[0]; // ya vienen del más reciente al más antiguo
  const area = esArea(row.area) ? (row.area as Area) : ("Línea amiga / Chat" as Area);
  const valores = (row.datos ?? {}) as Partial<Record<CampoDesempeno, string>>;

  const res = calcularBono(area, valores, row.asesor);
  const detalle: MiBonoDetalle[] = res.detalle.map((d) => ({
    campo: d.campo,
    label: LABELS[d.campo] ?? d.campo,
    monto: d.monto,
    montoLabel: fmtMoney(d.monto),
    cumple: d.cumple,
    valor: d.valor,
  }));

  // Monto: el guardado en el snapshot si existe; si no, el recalculado.
  const guardado = parseInt(String(valores.bono ?? "").replace(/[^\d]/g, ""), 10);
  const total = Number.isFinite(guardado) && guardado > 0 ? guardado : res.total;

  return {
    mes: row.mes,
    mesLabel: mesLabel(row.mes),
    nombre: row.nombre || nombre || row.asesor,
    area: row.area || area,
    total,
    totalLabel: fmtMoney(total),
    topeMaximo: res.topeMaximo,
    topeLabel: fmtMoney(res.topeMaximo),
    porcentaje: res.topeMaximo > 0 ? Math.round((total / res.topeMaximo) * 100) : 0,
    detalle,
    frase: FRASES[Math.floor(Math.random() * FRASES.length)],
  };
}
