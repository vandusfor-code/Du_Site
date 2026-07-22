"use server";

import { auth } from "@/auth";
import { clasificarConIA, guardarRegistro, type ClasificacionResultado, type ModoBusqueda } from "@/lib/pqrs";

async function usuarioActual(): Promise<string> {
  const session = await auth();
  const usuario = session?.user?.usuario;
  if (!usuario) throw new Error("No autenticado");
  return usuario;
}

export async function buscarAction(
  query: string,
  mode: ModoBusqueda
): Promise<ClasificacionResultado> {
  const usuario = await usuarioActual();
  const [resultado] = await Promise.all([
    clasificarConIA(query, mode),
    guardarRegistro(usuario, `${mode}: ${query}`).catch(() => {}),
  ]);
  return resultado;
}
