import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { ModuloId } from "@/lib/modulos";

export async function requireModulo(id: ModuloId) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.modulos.includes(id)) redirect("/");
  return session;
}

// Fuente oficial del privilegio administrativo: la columna Rol de la hoja
// "Usuarios" (Usuarios!F). NO se infiere de los módulos ni del nombre/usuario.
// La ausencia de rol (p. ej. un JWT antiguo) nunca cuenta como Admin.
export function esAdmin(session: Session | null): boolean {
  return (session?.user?.rol ?? "").toString().trim().toLowerCase() === "admin";
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!esAdmin(session)) redirect("/");
  return session;
}
