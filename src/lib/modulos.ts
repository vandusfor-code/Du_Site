export type ModuloId = "metricas" | "pqrsf-data" | "linea-amiga" | "radicaciones" | "quiz" | "admin" | "desempeno" | "documentacion" | "pqrsf-comunicar";

export interface Modulo {
  id: ModuloId;
  nombre: string;
  descripcion: string;
  href: string;
  color: string;
}

export const MODULOS: Modulo[] = [
  {
    id: "metricas",
    nombre: "Métricas",
    descripcion: "Indicadores y reportes de gestión.",
    href: "/modulos/metricas",
    color: "#2563eb",
  },
  {
    id: "pqrsf-data",
    nombre: "PQRSF DATA",
    descripcion: "Clasificación y búsqueda inteligente de casos PQRSF.",
    href: "/modulos/pqrsf-data",
    color: "#16a34a",
  },
  {
    id: "linea-amiga",
    nombre: "Línea Amiga",
    descripcion: "Radicación de PQRSF, chat y notificaciones de turno.",
    href: "/modulos/linea-amiga",
    color: "#0891b2",
  },
  {
    id: "radicaciones",
    nombre: "Radicaciones",
    descripcion: "Registro y control de radicaciones.",
    href: "/modulos/radicaciones",
    color: "#d97706",
  },
  {
    id: "quiz",
    nombre: "DuAcademy",
    descripcion: "Formación, evaluaciones y simulaciones con IA.",
    href: "/modulos/quiz",
    color: "#9333ea",
  },
  {
    id: "admin",
    nombre: "Auditorías",
    descripcion: "Carga de transcripciones, auditorías con IA e historial consolidado.",
    href: "/admin",
    color: "#4f46e5",
  },
  {
    id: "desempeno",
    nombre: "Desempeño",
    descripcion: "Rendimiento de funcionarios, productividad, adherencia, indicadores por área, ranking y bonificación.",
    href: "/modulos/desempeno",
    color: "#7044ed",
  },
  {
    id: "documentacion",
    nombre: "Documentación Operativa",
    descripcion: "Centraliza, documenta y valida el conocimiento operativo de los aplicativos.",
    href: "/modulos/documentacion",
    color: "#4f46e5",
  },
  {
    id: "pqrsf-comunicar",
    nombre: "PQRSF Por comunicar",
    descripcion: "Registro e importación de PQRSF pendientes por comunicar.",
    href: "/modulos/pqrsf-comunicar",
    color: "#6952e8",
  },
];

export function modulosPermitidos(ids: string[]): Modulo[] {
  return MODULOS.filter((m) => ids.includes(m.id));
}
