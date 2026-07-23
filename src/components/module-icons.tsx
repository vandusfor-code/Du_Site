import {
  BarChart3,
  FolderOpen,
  GraduationCap,
  Headphones,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ModuloId } from "@/lib/modulos";

export interface ModuloVisual {
  icon: LucideIcon;
  /** Accent used for the icon tile background */
  accentBg: string;
  /** Accent used for the icon color / small graphic details */
  accentFg: string;
}

export const MODULO_VISUALS: Record<ModuloId, ModuloVisual> = {
  metricas: { icon: BarChart3, accentBg: "rgba(186,255,0,0.14)", accentFg: "#baff00" },
  "pqrsf-data": { icon: Search, accentBg: "#ede9fe", accentFg: "#7257ff" },
  "linea-amiga": { icon: Headphones, accentBg: "#ccfbf1", accentFg: "#0d9488" },
  radicaciones: { icon: FolderOpen, accentBg: "#ffedd5", accentFg: "#ea580c" },
  quiz: { icon: GraduationCap, accentBg: "#ffe4e6", accentFg: "#e11d48" },
};
