import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ModuloId } from "@/lib/modulos";

export async function requireModulo(id: ModuloId) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.modulos.includes(id)) redirect("/");
  return session;
}

// El acceso admin se controla agregando "admin" a la columna Modulos del
// usuario en la hoja Usuarios — no requiere una columna ni tabla nueva.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.modulos.includes("admin")) redirect("/");
  return session;
}
