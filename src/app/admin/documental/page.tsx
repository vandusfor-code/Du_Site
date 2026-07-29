import { requireAdmin } from "@/lib/auth-helpers";
import AdminSidebar from "../AdminSidebar";
import AuditoriaDocumental from "./AuditoriaDocumental";

export default async function AuditoriaDocumentalPage() {
  const session = await requireAdmin();

  return (
    <>
      <AdminSidebar nombre={session.user.nombre} activo="Auditoría Documental" />
      <AuditoriaDocumental />
    </>
  );
}
