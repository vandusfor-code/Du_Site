"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import {
  listarUsuariosAdmin,
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  restablecerPasswordAdmin,
  type UsuarioAdmin,
  type NuevoUsuarioInput,
  type CambiosUsuario,
} from "@/lib/usuarios-admin";

type Resultado = { ok: true } | { ok: false; error: string };

export async function listarUsuariosAction(): Promise<UsuarioAdmin[]> {
  await requireAdmin();
  return listarUsuariosAdmin();
}

export async function crearUsuarioAction(input: NuevoUsuarioInput): Promise<Resultado> {
  await requireAdmin();
  return crearUsuarioAdmin(input);
}

export async function actualizarUsuarioAction(usuario: string, cambios: CambiosUsuario): Promise<Resultado> {
  await requireAdmin();
  return actualizarUsuarioAdmin(usuario, cambios);
}

export async function restablecerPasswordAction(usuario: string, nuevaPassword: string): Promise<Resultado> {
  await requireAdmin();
  return restablecerPasswordAdmin(usuario, nuevaPassword);
}
