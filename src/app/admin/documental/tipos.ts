// Tipos client-safe de Auditoría Documental (sin dependencias de servidor).

export interface RegistroDoc {
  audId: string;
  radicado: string;
  asesora: string; // Radicador (agente People)
  usuario: string; // Trabajador / afiliado
  tipoSolicitud: string;
  fecha: string; // Fecha de recibido
  fechaCarga: string;
  origen: string; // PEOPLE / COFREM / OTRO
  puntaje: number; // calidad general
  errores: number;
  estado: string; // "Revisar" | "Sin novedades"
  // Detalle
  solicitudOriginal: string;
  respuestaOriginal: string;
  respuestaCorregida: string;
  erroresDetectados: string;
  explicacion: string;
  calidad: { ortografia: number; redaccion: number; claridad: number; coherencia: number; general: number };
  correspondencia: number;
  estadoCorrespondencia: string;
  hallazgo: string;
}

export interface ResumenDoc {
  documentosAuditados: number;
  conErrores: number;
  promedioCalidad: number;
  sinNovedades: number;
  asesorasEvaluadas: number;
}

export interface ResultadoImportacionUI {
  audId: string;
  archivo: string;
  encontrados: number;
  nuevos: number;
  duplicados: number;
  procesados: number;
  conErrores: number;
  sinNovedades: number;
  requierenRevision: number;
  promedioCalidad: number;
  asesoras: number;
  camposNoGuardados: string[];
}

export interface HistorialImportacionUI {
  audId: string; fecha: string; archivo: string; usuario: string;
  encontrados: string; nuevos: string; duplicados: string; procesados: string;
  conErrores: string; sinNovedades: string; promedioCalidad: string; asesoras: string; estado: string;
}

export interface DashboardDocumental {
  resumen: ResumenDoc;
  registros: RegistroDoc[];
  historial: HistorialImportacionUI[];
}
