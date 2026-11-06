import {
  CONFIG_REGLAS,
  type ConfigReglas,
  type RegistroPila,
  type ResumenPeriodo,
  type ResultadoValidacion,
  type Inconsistencia,
  type TipoTrabajador,
  type Novedad,
} from "./pila-tipos";

// ============================================================
// MOTOR DE REGLAS — Validador PILA. DETERMINÍSTICO: sin IA, sin aleatoriedad.
// Cada resultado es reproducible a partir de (registros + tipo + fechaSolicitud
// + versión de config). La IA no decide nada aquí.
//
// Reglas (ver prompt maestro): ventana de 3 años por periodo; aporte 0 excluye
// el registro (pero se conserva); días desde "Días Cot"; consolidación por
// periodo conservando el detalle; tope de 30 días/mes; duplicados exactos →
// inconsistencia crítica (revisión); novedades informativas (no descuentan
// días). Umbrales operativos v1 (no normativos) en CONFIG_REGLAS.
// ============================================================

// AAAAMM de la fecha de solicitud y del inicio de ventana (3 años atrás, por mes).
function limitesVentana(fechaSolicitudISO: string, anios: number): { desde: number; hasta: number; desdeISO: string } {
  const [y, m, d] = fechaSolicitudISO.split("-").map((x) => parseInt(x, 10));
  const hasta = y * 100 + m;
  const desdeY = y - anios;
  const desde = desdeY * 100 + m;
  const desdeISO = `${desdeY}-${String(m).padStart(2, "0")}-${String(d || 1).padStart(2, "0")}`;
  return { desde, hasta, desdeISO };
}

function claveDuplicado(r: RegistroPila): string {
  return [r.nit, r.periodo, r.fechaPago, r.aporte, r.diasCot, r.planilla ?? ""].join("|");
}

export function validarPila(
  registros: RegistroPila[],
  tipoTrabajador: TipoTrabajador,
  fechaSolicitudISO: string,
  config: ConfigReglas = CONFIG_REGLAS
): ResultadoValidacion {
  const diasRequeridos = config.diasRequeridos[tipoTrabajador];
  const { desde, hasta, desdeISO } = limitesVentana(fechaSolicitudISO, config.ventanaAnios);
  const inconsistencias: Inconsistencia[] = [];

  // Regla 7: duplicados EXACTOS (misma identidad completa) → crítica. No se
  // eliminan automáticamente; se marcan para revisión.
  const vistos = new Map<string, number>();
  let registrosSospechososDuplicado = 0;
  for (const r of registros) {
    const k = claveDuplicado(r);
    const n = (vistos.get(k) ?? 0) + 1;
    vistos.set(k, n);
    if (n > 1) {
      registrosSospechososDuplicado++;
      inconsistencias.push({
        nivel: "critica",
        periodo: r.periodo,
        mensaje: `Registro exactamente duplicado en el periodo ${r.periodo} (NIT ${r.nit}, planilla ${r.planilla ?? "—"}). Verifica si es un error de extracción antes de contabilizarlo.`,
      });
    }
  }

  // Agrupar por periodo (conservando TODOS los registros, incluidos aporte 0 y
  // fuera de ventana, para el detalle auditable).
  const porPeriodo = new Map<string, RegistroPila[]>();
  for (const r of registros) {
    if (!porPeriodo.has(r.periodo)) porPeriodo.set(r.periodo, []);
    porPeriodo.get(r.periodo)!.push(r);
  }

  let registrosConAporte = 0;
  let registrosAporteCero = 0;
  let registrosFueraVentana = 0;

  const resumenPorPeriodo: ResumenPeriodo[] = [];
  for (const [periodo, lista] of porPeriodo) {
    const periodoNum = parseInt(periodo, 10);
    const fueraDeVentana = !(periodoNum >= desde && periodoNum <= hasta);

    const positivos = lista.filter((r) => r.aporte > 0);
    const ceros = lista.filter((r) => r.aporte <= 0);
    registrosConAporte += positivos.length;
    registrosAporteCero += ceros.length;
    if (fueraDeVentana) registrosFueraVentana += lista.length;

    // Regla 4/5: días desde "Días Cot" de los registros con aporte > 0, sumados.
    const diasReportados = positivos.reduce((s, r) => s + r.diasCot, 0);
    // Regla 6: tope de 30 días/mes (consolidando empresas/registros).
    const diasReconocidosBruto = Math.min(diasReportados, config.maxDiasPorPeriodo);
    const excedeLimite = diasReportados > config.maxDiasPorPeriodo;
    // Solo cuentan los periodos dentro de la ventana.
    const diasReconocidos = fueraDeVentana ? 0 : diasReconocidosBruto;

    const aporteAcumulado = positivos.reduce((s, r) => s + r.aporte, 0);
    const nits = Array.from(new Set(lista.map((r) => r.nit)));
    const novedades = Array.from(new Set(lista.flatMap((r) => r.novedades))) as Novedad[];

    let estado: ResumenPeriodo["estado"] = "contabilizado";
    if (fueraDeVentana || positivos.length === 0) estado = "excluido";

    if (excedeLimite && !fueraDeVentana) {
      inconsistencias.push({
        nivel: "advertencia",
        periodo,
        mensaje: `El periodo ${periodo} reporta ${diasReportados} días entre ${nits.length} empresa(s); se reconocen ${config.maxDiasPorPeriodo} por el tope mensual (exceso de ${diasReportados - config.maxDiasPorPeriodo}).`,
      });
    }

    resumenPorPeriodo.push({
      periodo, nits, registros: lista.length,
      diasReportados, diasReconocidos, aporteAcumulado, novedades,
      estado, excedeLimite, fueraDeVentana, detalle: lista,
    });
  }

  resumenPorPeriodo.sort((a, b) => a.periodo.localeCompare(b.periodo));

  const diasAcreditados = resumenPorPeriodo.reduce((s, p) => s + p.diasReconocidos, 0);
  const periodosConAporte = resumenPorPeriodo.filter((p) => !p.fueraDeVentana && p.diasReconocidos > 0).length;
  const diasDiferencia = diasAcreditados - diasRequeridos;

  // Regla 9: estado final.
  const hayCriticas = inconsistencias.some((i) => i.nivel === "critica");
  const sinDatos = registros.length === 0;

  let estado: ResultadoValidacion["estado"];
  let motivo: string;
  if (sinDatos) {
    estado = "REQUIERE_REVISION";
    motivo = "No se pudieron leer registros de aporte del documento. Verifica el archivo o realiza la revisión manual.";
  } else if (hayCriticas) {
    estado = "REQUIERE_REVISION";
    motivo = "Se detectaron inconsistencias que impiden emitir un resultado confiable (ver detalle). Requiere revisión del asesor.";
  } else if (diasAcreditados >= diasRequeridos) {
    estado = "CUMPLE";
    motivo = `El usuario acredita ${diasAcreditados} días dentro de la ventana evaluada, alcanzando el mínimo de ${diasRequeridos} días requeridos.`;
  } else {
    estado = "NO_CUMPLE";
    motivo = `El usuario acredita ${diasAcreditados} días dentro de la ventana evaluada; faltan ${diasRequeridos - diasAcreditados} para el mínimo de ${diasRequeridos} días.`;
  }

  return {
    estado, motivo, tipoTrabajador,
    fechaSolicitud: fechaSolicitudISO,
    ventana: { desde: desdeISO, hasta: fechaSolicitudISO },
    diasRequeridos, diasAcreditados, diasDiferencia, periodosConAporte,
    resumenPorPeriodo, inconsistencias,
    analisis: {
      registrosLeidos: registros.length,
      registrosConAporte,
      registrosAporteCero,
      registrosFueraVentana,
      registrosSospechososDuplicado,
    },
    versionMotor: config.version,
  };
}
