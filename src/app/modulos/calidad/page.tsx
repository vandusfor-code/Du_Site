import { requireModulo } from "@/lib/auth-helpers";
import { BackHomeLink } from "@/components/module-shell";

// Ruta base del módulo "calidad" — deja el permiso y la protección de acceso
// listos. El panel real (auditorías, compromisos, seguimiento, verificación)
// se construye en una fase posterior; no hay funcionalidad todavía.
export default async function CalidadPage() {
  await requireModulo("calidad");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <BackHomeLink />
      <h1 style={{ marginTop: 24, fontSize: 24, fontWeight: 800 }}>
        Calidad / Seguimiento de Auditorías
      </h1>
      <p style={{ marginTop: 12, color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
        Este módulo está en construcción. Aquí vivirá el panel de gestión de
        auditorías, compromisos y seguimiento para Formación y Calidad.
      </p>
    </div>
  );
}
