// Indicador de carga GLOBAL del App Router. Next lo muestra al instante al
// navegar a cualquier ruta mientras el servidor renderiza, así ninguna
// navegación se siente "congelada" ni muerta (aunque el servidor tarde).
export default function Loading() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div className="du-spin" style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(109,40,217,.18)", borderTopColor: "#6d28d9" }} />
        <div style={{ fontSize: 13, color: "var(--muted-foreground, #9199a8)", fontFamily: "Inter, system-ui, sans-serif" }}>Cargando…</div>
      </div>
      <style>{`.du-spin{animation:du-spin .7s linear infinite}@keyframes du-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
