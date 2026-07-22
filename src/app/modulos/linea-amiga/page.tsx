import { requireModulo } from "@/lib/auth-helpers";
import LineaAmigaDashboard from "./LineaAmigaDashboard";

export default async function LineaAmigaPage() {
  const session = await requireModulo("linea-amiga");

  const sugerenciasId = process.env.SHEET_ID_SUGERENCIAS_PQRSF;
  const sugerenciasUrl = sugerenciasId
    ? `https://docs.google.com/spreadsheets/d/${sugerenciasId}`
    : null;

  return <LineaAmigaDashboard nombre={session.user.nombre} sugerenciasUrl={sugerenciasUrl} />;
}
