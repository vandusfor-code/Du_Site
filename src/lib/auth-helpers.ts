import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ModuloId } from "@/lib/modulos";

export async function requireModulo(id: ModuloId) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.modulos.includes(id)) redirect("/");
  return session;
}
