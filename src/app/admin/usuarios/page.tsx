import { requireAdmin } from "@/lib/auth-helpers";
import { listarUsuariosAdmin, type UsuarioAdmin } from "@/lib/usuarios-admin";
import { MODULOS } from "@/lib/modulos";
import UsuariosDashboard from "./UsuariosDashboard";

export const maxDuration = 60;

export default async function UsuariosPage() {
  const session = await requireAdmin();

  let usuarios: UsuarioAdmin[] = [];
  let error: string | null = null;
  try {
    usuarios = await listarUsuariosAdmin();
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudieron cargar los usuarios";
  }

  return (
    <UsuariosDashboard
      nombre={session.user.nombre}
      usuariosIniciales={usuarios}
      errorInicial={error}
      modulos={MODULOS}
    />
  );
}
