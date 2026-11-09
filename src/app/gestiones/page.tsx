import { requireAdminOCoordinadora } from "@/lib/auth-helpers";
import { listarRegistrosRadicacion, type RegistroRadicacion } from "@/lib/radicaciones";
import { listarRegistrosPQRSF, type RegistroPQRSF } from "@/lib/lineaAmiga";
import { listarRegistrosComunicar, type RegistroComunicar } from "@/lib/pqrsf-comunicar";
import GestionesView from "./GestionesView";
import type { TipoGestion } from "./actions";

export const maxDuration = 30;

// Listado de registros (PQRSF creados, Radicaciones o PQRSF por comunicar) para
// Admin/Coordinación. Se abre desde las tarjetas del inicio. Ver y ELIMINAR.
export default async function GestionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireAdminOCoordinadora();
  const { tipo: tipoRaw } = await searchParams;
  const tipo: TipoGestion =
    tipoRaw === "pqrsf" ? "pqrsf" : tipoRaw === "por-comunicar" ? "por-comunicar" : "radicaciones";

  let registros: (RegistroRadicacion | RegistroPQRSF | RegistroComunicar)[] = [];
  let error: string | null = null;
  try {
    registros =
      tipo === "pqrsf"
        ? await listarRegistrosPQRSF()
        : tipo === "por-comunicar"
          ? await listarRegistrosComunicar()
          : await listarRegistrosRadicacion();
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo cargar el listado";
  }

  return <GestionesView tipo={tipo} registrosIniciales={registros} errorInicial={error} />;
}
