import "server-only";
import { readRange } from "@/lib/sheets";

function sheetIdListado(): string {
  const id = process.env.SHEET_ID_PQRSF_LISTADO;
  if (!id) throw new Error("Falta la variable SHEET_ID_PQRSF_LISTADO");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

export interface RegistroPqrsf {
  radicado: string;
  tipo: string;
  dirigidoA: string;
  resumen: string;
  radicador: string;
  canal: string;
  descripcion: string;
  respuesta: string;
}

export async function obtenerListadoPqrsf(): Promise<RegistroPqrsf[]> {
  const id = sheetIdListado();
  const data = await readRange(id, "PQRSF");

  return data.slice(1).map((row) => ({
    radicado: texto(row, 0),
    tipo: texto(row, 1),
    dirigidoA: texto(row, 2),
    resumen: texto(row, 3),
    radicador: texto(row, 4),
    canal: texto(row, 5),
    descripcion: texto(row, 6),
    respuesta: texto(row, 7),
  })).filter((r) => r.radicado);
}
