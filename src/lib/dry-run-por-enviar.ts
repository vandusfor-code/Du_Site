import "server-only";
import { readRange } from "./sheets";
import { getSupabase } from "./supabase";

// ============================================================
// DRY-RUN — Corrida 2 ("Por enviar" → requiere_compromiso)
//
// SOLO LECTURA. No escribe en Supabase (ni ciclo_auditoria, ni evento_ciclo)
// ni en Google Sheets. Cruza Consolidado."Por enviar" contra el estado real
// de ciclo_auditoria y reporta qué pasaría si se ejecutara la Corrida 2,
// sin ejecutarla. Se puede borrar sin tocar nada de producción una vez que
// la Corrida 2 real quede autorizada e implementada.
// ============================================================

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

// Mismos índices que gestion-auditorias.ts (Consolidado nunca se reordena).
const COL_ASESOR = 2;
const COL_ID_GESTION = 6;
const COL_TIPO_NOTA = 17;
const COL_POR_ENVIAR = 28; // Columna AC

const LARGO_MAXIMO_ID_GESTION = 500;
const TAMANO_PAGINA = 1000;

type AccionPropuesta =
  | "CASO_1_NUEVA_SOLICITUD_CREADA"
  | "CASO_2_NUEVA_SOLICITUD_NO_ELEGIBLE"
  | "CASO_5_YA_TIENE_COMPROMISO"
  | "SIN_CICLO"
  | "ID_GESTION_INVALIDO_O_FALTANTE"
  | "ESTADO_NO_CONTEMPLADO";

export interface CasoPorEnviar {
  idGestion: string;
  asesor: string;
  resultado: string;
  estadoActual: string;
  motivoNoElegible: string | null;
  porEnviarRaw: string;
  requiereCompromisoActual: boolean | null;
  accion: AccionPropuesta;
  necesitoNormalizacion: boolean;
}

export interface ReporteDryRunPorEnviar {
  // Universo analizado: mismo criterio de dedupe que adoptarAuditorias
  // (ID Gestión no vacío, primera fila vista por ID repetido) — 1091 en la
  // Corrida 1. No incluye filas con ID Gestión vacío; esas se cuentan aparte
  // en filasConIdGestionVacioYPorEnviarOk.
  totalAuditoriasAnalizadas: number;
  totalPorEnviarOk: number;
  necesitaronNormalizacion: number;
  variantesCrudasVistas: string[];
  correspondenCreada: number;
  correspondenNoElegible: number;
  yaTieneCompromisoActivo: number;
  nuevasSolicitudesCompromiso: number;
  eventosACrear: number;
  sinCiclo: number;
  idGestionInvalidoOFaltante: number;
  filasConIdGestionVacioYPorEnviarOk: number;
  problemaDeIdentidad: number;
  problemaDeIdentidadPorMotivo: Record<string, number>;
  estadoNoContemplado: number;
  casos: CasoPorEnviar[];
  casosTruncados: boolean;
}

export async function dryRunPorEnviar(): Promise<ReporteDryRunPorEnviar> {
  const id = sheetId();
  const supabase = getSupabase();

  const consolidadoRaw = await readRange(id, "Consolidado!A2:AC", { unformatted: true });

  // Universo: igual que adoptarAuditorias (dedupe por ID Gestión, primera
  // fila vista gana). Se guardan aparte las filas con ID Gestión vacío,
  // porque no tienen clave de dedupe y adoptarAuditorias las ignora del
  // todo — aquí sí importan si además tienen "Por enviar" = OK.
  const filaPorIdGestion = new Map<string, unknown[]>();
  const filasIdGestionVacio: unknown[][] = [];
  for (const r of consolidadoRaw) {
    const idg = texto(r, COL_ID_GESTION).trim();
    if (!idg) {
      filasIdGestionVacio.push(r);
      continue;
    }
    if (!filaPorIdGestion.has(idg)) filaPorIdGestion.set(idg, r);
  }

  // Todo ciclo_auditoria, paginado explícitamente (Corrida 1 mostró que
  // .select() sin .range() se corta en 1000 filas).
  const ciclosPorIdGestion = new Map<
    string,
    { estado: string; motivo_no_elegible: string | null; requiere_compromiso: boolean }
  >();
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from("ciclo_auditoria")
      .select("id_gestion, estado, motivo_no_elegible, requiere_compromiso")
      .range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(`Supabase (ciclo_auditoria): ${error.message || "sin mensaje"} | code=${error.code ?? "?"}`);
    const pagina = data ?? [];
    for (const row of pagina) {
      const r = row as { id_gestion: string; estado: string; motivo_no_elegible: string | null; requiere_compromiso: boolean };
      ciclosPorIdGestion.set(r.id_gestion, {
        estado: r.estado,
        motivo_no_elegible: r.motivo_no_elegible,
        requiere_compromiso: r.requiere_compromiso,
      });
    }
    if (pagina.length < TAMANO_PAGINA) break;
  }

  const variantesCrudas = new Set<string>();
  let totalPorEnviarOk = 0;
  let necesitaronNormalizacion = 0;
  let correspondenCreada = 0;
  let correspondenNoElegible = 0;
  let yaTieneCompromisoActivo = 0;
  let nuevasSolicitudesCompromiso = 0;
  let sinCiclo = 0;
  let idGestionInvalidoOFaltante = 0;
  let estadoNoContemplado = 0;
  const problemaDeIdentidadPorMotivo: Record<string, number> = {};
  const casos: CasoPorEnviar[] = [];

  function normalizado(raw: string): string {
    return raw.trim().toUpperCase();
  }

  function registrarNormalizacion(raw: string) {
    if (raw !== "OK") {
      necesitaronNormalizacion++;
      variantesCrudas.add(raw);
    }
  }

  // Filas con ID Gestión — el universo principal (1091 en Corrida 1).
  for (const [idGestion, fila] of filaPorIdGestion) {
    const porEnviarRaw = texto(fila, COL_POR_ENVIAR);
    const porEnviarNorm = normalizado(porEnviarRaw);

    if (porEnviarNorm === "") continue; // CASO 3
    if (porEnviarNorm !== "OK") continue; // CASO 4

    totalPorEnviarOk++;
    registrarNormalizacion(porEnviarRaw);

    const asesor = texto(fila, COL_ASESOR);
    const resultado = texto(fila, COL_TIPO_NOTA).trim().toUpperCase();

    if (idGestion.length > LARGO_MAXIMO_ID_GESTION) {
      idGestionInvalidoOFaltante++;
      casos.push({
        idGestion: `${idGestion.slice(0, 60)}… (${idGestion.length} caracteres)`,
        asesor,
        resultado,
        estadoActual: "ID_INVALIDO",
        motivoNoElegible: null,
        porEnviarRaw,
        requiereCompromisoActual: null,
        accion: "ID_GESTION_INVALIDO_O_FALTANTE",
        necesitoNormalizacion: porEnviarRaw !== "OK",
      });
      continue;
    }

    const ciclo = ciclosPorIdGestion.get(idGestion);
    if (!ciclo) {
      sinCiclo++;
      casos.push({
        idGestion,
        asesor,
        resultado,
        estadoActual: "SIN_CICLO",
        motivoNoElegible: null,
        porEnviarRaw,
        requiereCompromisoActual: null,
        accion: "SIN_CICLO",
        necesitoNormalizacion: porEnviarRaw !== "OK",
      });
      continue;
    }

    if (ciclo.estado === "CREADA") correspondenCreada++;
    else if (ciclo.estado === "NO_ELEGIBLE") correspondenNoElegible++;

    if (ciclo.requiere_compromiso) {
      yaTieneCompromisoActivo++;
      casos.push({
        idGestion,
        asesor,
        resultado,
        estadoActual: ciclo.estado,
        motivoNoElegible: ciclo.motivo_no_elegible,
        porEnviarRaw,
        requiereCompromisoActual: true,
        accion: "CASO_5_YA_TIENE_COMPROMISO",
        necesitoNormalizacion: porEnviarRaw !== "OK",
      });
      continue;
    }

    if (ciclo.estado === "CREADA") {
      nuevasSolicitudesCompromiso++;
      casos.push({
        idGestion,
        asesor,
        resultado,
        estadoActual: "CREADA",
        motivoNoElegible: null,
        porEnviarRaw,
        requiereCompromisoActual: false,
        accion: "CASO_1_NUEVA_SOLICITUD_CREADA",
        necesitoNormalizacion: porEnviarRaw !== "OK",
      });
    } else if (ciclo.estado === "NO_ELEGIBLE") {
      nuevasSolicitudesCompromiso++;
      const motivo = ciclo.motivo_no_elegible ?? "?";
      problemaDeIdentidadPorMotivo[motivo] = (problemaDeIdentidadPorMotivo[motivo] ?? 0) + 1;
      casos.push({
        idGestion,
        asesor,
        resultado,
        estadoActual: "NO_ELEGIBLE",
        motivoNoElegible: ciclo.motivo_no_elegible,
        porEnviarRaw,
        requiereCompromisoActual: false,
        accion: "CASO_2_NUEVA_SOLICITUD_NO_ELEGIBLE",
        necesitoNormalizacion: porEnviarRaw !== "OK",
      });
    } else {
      estadoNoContemplado++;
      casos.push({
        idGestion,
        asesor,
        resultado,
        estadoActual: ciclo.estado,
        motivoNoElegible: ciclo.motivo_no_elegible,
        porEnviarRaw,
        requiereCompromisoActual: false,
        accion: "ESTADO_NO_CONTEMPLADO",
        necesitoNormalizacion: porEnviarRaw !== "OK",
      });
    }
  }

  // Filas sin ID Gestión — fuera del universo de 1091, pero si además
  // tienen "Por enviar" = OK son un problema real que hay que ver.
  let filasConIdGestionVacioYPorEnviarOk = 0;
  for (const fila of filasIdGestionVacio) {
    const porEnviarRaw = texto(fila, COL_POR_ENVIAR);
    const porEnviarNorm = normalizado(porEnviarRaw);
    if (porEnviarNorm !== "OK") continue;

    filasConIdGestionVacioYPorEnviarOk++;
    totalPorEnviarOk++;
    idGestionInvalidoOFaltante++;
    registrarNormalizacion(porEnviarRaw);

    casos.push({
      idGestion: "(vacío)",
      asesor: texto(fila, COL_ASESOR),
      resultado: texto(fila, COL_TIPO_NOTA).trim().toUpperCase(),
      estadoActual: "ID_GESTION_VACIO",
      motivoNoElegible: null,
      porEnviarRaw,
      requiereCompromisoActual: null,
      accion: "ID_GESTION_INVALIDO_O_FALTANTE",
      necesitoNormalizacion: porEnviarRaw !== "OK",
    });
  }

  const LIMITE_CASOS = 300;
  const casosTruncados = casos.length > LIMITE_CASOS;

  return {
    totalAuditoriasAnalizadas: filaPorIdGestion.size,
    totalPorEnviarOk,
    necesitaronNormalizacion,
    variantesCrudasVistas: [...variantesCrudas],
    correspondenCreada,
    correspondenNoElegible,
    yaTieneCompromisoActivo,
    nuevasSolicitudesCompromiso,
    eventosACrear: nuevasSolicitudesCompromiso,
    sinCiclo,
    idGestionInvalidoOFaltante,
    filasConIdGestionVacioYPorEnviarOk,
    problemaDeIdentidad: correspondenNoElegible,
    problemaDeIdentidadPorMotivo,
    estadoNoContemplado,
    casos: casosTruncados ? casos.slice(0, LIMITE_CASOS) : casos,
    casosTruncados,
  };
}
