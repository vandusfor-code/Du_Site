"use client";

import Link from "next/link";

// Fase actual: la presentación de evaluaciones por la asesora se habilita en el
// siguiente paso. Esta vista evita un estado roto mientras tanto.
export default function EvaluacionesAsesora({ nombre }: { nombre: string }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 20px", textAlign: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#667085", marginBottom: 10 }}>EVALUACIONES</div>
      <h1 style={{ fontSize: 30, margin: "0 0 10px", color: "#17202d" }}>Hola, {nombre}</h1>
      <p style={{ color: "#737e90", fontSize: 15, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
        Aquí presentarás tus evaluaciones de conocimiento operativo. Estamos habilitando esta sección; muy pronto
        verás tus módulos pendientes y los que ya hayas presentado.
      </p>
      <Link href="/" style={{ display: "inline-block", marginTop: 26, color: "#1677ff", fontWeight: 600, fontSize: 14 }}>
        ← Volver al inicio
      </Link>
    </div>
  );
}
