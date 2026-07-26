import {
  BarChart3,
  FolderOpen,
  GraduationCap,
  Headphones,
  Search,
  ShieldCheck,
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
  metricas: { icon: BarChart3, accentBg: "#ecfccb", accentFg: "#65a30d" },
  "pqrsf-data": { icon: Search, accentBg: "#e0d7ff", accentFg: "#6d28d9" },
  "linea-amiga": { icon: Headphones, accentBg: "#99f6e4", accentFg: "#0f766e" },
  radicaciones: { icon: FolderOpen, accentBg: "#fed7aa", accentFg: "#c2410c" },
  quiz: { icon: GraduationCap, accentBg: "#fecdd3", accentFg: "#be123c" },
  admin: { icon: ShieldCheck, accentBg: "#e0e7ff", accentFg: "#4f46e5" },
};
