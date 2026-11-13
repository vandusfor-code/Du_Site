import type { Metadata } from "next";
import HuspyApp from "./HuspyApp";

export const metadata: Metadata = {
  title: "Huspy · Formación",
  description: "Jornada de formación interactiva para agentes de primer contacto de Huspy.",
};

// Ruta PÚBLICA (sin login) — exenta en proxy.ts. Experiencia a pantalla completa.
export default function HuspyPage() {
  return <HuspyApp />;
}
