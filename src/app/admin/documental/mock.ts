// Datos mock de Auditoría Documental. Estructura preparada para sustituir por
// datos reales sin rediseñar los componentes. (Fase visual: sin backend real.)

export interface ErrorDetectado {
  categoria: string;
  original: string;
  corregido: string;
  explicacion: string;
}
export interface CalidadDoc {
  general: number;
  ortografia: number;
  redaccion: number;
  claridad: number;
  coherencia: number;
  cumplimiento: number;
}
export interface CriterioDoc {
  nombre: string;
  resultado: "Cumple" | "Revisar";
}
export interface HistorialDoc {
  fecha: string;
  evento: string;
}
export interface RadicadoFalla {
  radicado: string;
  errores: number;
}
export interface AuditoriaDoc {
  id: number;
  auditoriaId: string;
  radicado: string;
  initials: string;
  asesora: string;
  usuario: string;
  tipoSolicitud: string;
  fecha: string;
  puntaje: number;
  errores: number;
  estado: "Revisar" | "Sin novedades";
  solicitudOriginal: string;
  respuestaOriginal: string;
  respuestaCorregida: string;
  erroresList: ErrorDetectado[];
  calidad: CalidadDoc;
  criterios: CriterioDoc[];
  historial: HistorialDoc[];
  radicadosFalla: RadicadoFalla[];
}

export const resumen = {
  documentosAuditados: 248,
  conErrores: 37,
  promedioCalidad: 94,
  sinNovedades: 211,
  asesorasEvaluadas: 16,
};

export const procesando = {
  archivo: "PQRSF_JULIO_2026.xlsx",
  procesados: 167,
  total: 248,
  pct: 67,
  etapas: [
    { nombre: "Validando estructura", estado: "hecho" as const },
    { nombre: "Leyendo registros", estado: "hecho" as const },
    { nombre: "Analizando texto", estado: "activo" as const },
    { nombre: "Generando resultados", estado: "pendiente" as const },
  ],
  iaChecks: ["Ortografía y gramática", "Redacción y estilo", "Claridad y coherencia", "Cumplimiento de criterios"],
};

const CRITERIOS_BASE = ["Ortografía", "Redacción", "Claridad", "Coherencia", "Cumplimiento"];

function calidadDesde(puntaje: number): CalidadDoc {
  const v = (delta: number) => Math.max(70, Math.min(100, puntaje + delta));
  return {
    general: puntaje,
    ortografia: v(2),
    redaccion: v(-2),
    claridad: v(4),
    coherencia: v(-1),
    cumplimiento: v(1),
  };
}
function criteriosDesde(puntaje: number): CriterioDoc[] {
  return CRITERIOS_BASE.map((n, i) => ({ nombre: n, resultado: puntaje >= 90 || i < 3 ? "Cumple" : "Revisar" }));
}

export const auditorias: AuditoriaDoc[] = [
  {
    id: 1, auditoriaId: "AUD-2026-07-000124", radicado: "PQ-2026-000124", initials: "BC",
    asesora: "Bleidis Cabarcas", usuario: "DRAMOS", tipoSolicitud: "Afiliación caja compensación",
    fecha: "29 jul 2026, 4:35 p. m.", puntaje: 96, errores: 1, estado: "Revisar",
    solicitudOriginal: "El usuario manifiesta que no a recibido respuesta sobre su solicitud de afiliación.",
    respuestaOriginal: "Se valida la información en el sistema y se confirma que el trámite se encuentra en proceso. En un plazo de 3 días habiles será contactado nuevamente.",
    respuestaCorregida: "El usuario manifiesta que no ha recibido respuesta sobre su solicitud de afiliación. Se valida la información en el sistema y se confirma que el trámite se encuentra en proceso. En un plazo de 3 días hábiles será contactado nuevamente con la novedad.",
    erroresList: [
      { categoria: "Error ortográfico", original: "El usuario manifiesta que no a recibido respuesta.", corregido: "El usuario manifiesta que no ha recibido respuesta.", explicacion: "Se reemplazó “a recibido” por “ha recibido” porque corresponde el verbo auxiliar “haber”, no la preposición “a”." },
    ],
    calidad: { general: 96, ortografia: 98, redaccion: 92, claridad: 100, coherencia: 94, cumplimiento: 95 },
    criterios: criteriosDesde(96),
    historial: [
      { fecha: "29 jul 2026, 4:35 p. m.", evento: "Análisis automático generado por IA." },
      { fecha: "29 jul 2026, 4:36 p. m.", evento: "Estado marcado como “Revisar”." },
    ],
    radicadosFalla: [{ radicado: "PQ-2026-000124", errores: 2 }],
  },
  ...([
    ["HT", "Heillen Rincón", "JCASTRO", "Subsidio monetario", "29 jul 2026, 3:21 p. m.", 88, 2, "Revisar", "PQ-2026-000131"],
    ["IT", "Ingrid Toscano", "LMARTINEZ", "Cambio de datos", "29 jul 2026, 2:10 p. m.", 92, 1, "Revisar", "PQ-2026-000138"],
    ["JN", "Juliana Núñez", "APEREZ", "Certificación laboral", "29 jul 2026, 1:44 p. m.", 100, 0, "Sin novedades", "PQ-2026-000142"],
    ["SO", "Stefania Ortega", "MLOPEZ", "Afiliación caja compensación", "29 jul 2026, 12:30 p. m.", 90, 2, "Revisar", "PQ-2026-000150"],
    ["VM", "Valentina Murcia", "RDUQUE", "Subsidio educativo", "29 jul 2026, 11:58 a. m.", 86, 3, "Revisar", "PQ-2026-000155"],
  ] as const).map((r, i): AuditoriaDoc => {
    const [initials, asesora, usuario, tipoSolicitud, fecha, puntaje, errores, estado, radicado] = r;
    return {
      id: i + 2,
      auditoriaId: `AUD-2026-07-0001${25 + i}`,
      radicado,
      initials, asesora, usuario, tipoSolicitud, fecha,
      puntaje, errores, estado: estado as AuditoriaDoc["estado"],
      solicitudOriginal: "El usuario solicita información sobre el estado de su trámite y expresa que aún no obtiene respuesta.",
      respuestaOriginal: "Se revisa el caso en el sistema y se informa al usuario el estado actual de la gestión.",
      respuestaCorregida: "Se revisa el caso en el sistema y se informa al usuario el estado actual de la gestión. Se le indica el tiempo estimado de respuesta y los canales de seguimiento disponibles.",
      erroresList: Array.from({ length: errores }, (_, k) => ({
        categoria: "Error ortográfico",
        original: k === 0 ? "no se a podido validar" : "de acuerdo ha lo solicitado",
        corregido: k === 0 ? "no se ha podido validar" : "de acuerdo a lo solicitado",
        explicacion: k === 0 ? "“ha” es forma del auxiliar “haber”; “a” es preposición." : "Se usa “a” (preposición), no “ha” (verbo haber), en esta locución.",
      })),
      calidad: calidadDesde(puntaje),
      criterios: criteriosDesde(puntaje),
      historial: [{ fecha, evento: "Análisis automático generado por IA." }],
      radicadosFalla: errores > 0 ? [{ radicado, errores }] : [],
    };
  }),
];
