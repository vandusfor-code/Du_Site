import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { obtenerResumenParaFirma } from "@/lib/resumen-diario";
import MiRetroalimentacion from "./MiRetroalimentacion";

export const dynamic = "force-dynamic";

export default async function MiRetroalimentacionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/mi-retroalimentacion");
  const nombre = session.user.nombre || "";
  let inicial = null;
  try { inicial = await obtenerResumenParaFirma(nombre); } catch { inicial = null; }
  return <MiRetroalimentacion nombre={nombre} inicial={inicial} />;
}
