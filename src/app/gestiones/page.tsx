import { requireAdminOCoordinadora } from "@/lib/auth-helpers";
import { listarRegistrosRadicacion, type RegistroRadicacion } from "@/lib/radicaciones";
import { listarRegistrosPQRSF, type RegistroPQRSF } from "@/lib/lineaAmiga";
import GestionesView from "./GestionesView";

export const maxDuration = 30;

// Listado de registros (PQRSF creados o Radicaciones) para Admin/Coordinación.
// Se abre desde las tarjetas del inicio. Permite ver y ELIMINAR registros.
export default async function GestionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireAdminOCoordinadora();
  const { tipo: tipoRaw } = await searchParams;
  const tipo: "pqrsf" | "radicaciones" = tipoRaw === "pqrsf" ? "pqrsf" : "radicaciones";

  let registros: (RegistroRadicacion | RegistroPQRSF)[] = [];
  let error: string | null = null;
  try {
    registros = tipo === "pqrsf" ? await listarRegistrosPQRSF() : await listarRegistrosRadicacion();
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo cargar el listado";
  }

  return <GestionesView tipo={tipo} registrosIniciales={registros} errorInicial={error} />;
}
