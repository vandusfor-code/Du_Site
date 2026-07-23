import {
  ChartColumnBig,
  FolderKanban,
  GraduationCap,
  Headset,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import type { ModuloId } from "@/lib/modulos";

export interface ModuloVisual {
  icon: LucideIcon;
  /** Accent used only as a subtle tint for the icon tile */
  tint: string;
}

export const MODULO_VISUALS: Record<ModuloId, ModuloVisual> = {
  metricas: { icon: ChartColumnBig, tint: "#16a34a" },
  "pqrsf-data": { icon: ScanSearch, tint: "#7c3aed" },
  "linea-amiga": { icon: Headset, tint: "#0d9488" },
  radicaciones: { icon: FolderKanban, tint: "#ea580c" },
  quiz: { icon: GraduationCap, tint: "#e11d48" },
};
