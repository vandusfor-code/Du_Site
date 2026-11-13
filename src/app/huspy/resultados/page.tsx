import type { Metadata } from "next";
import { listarResultadosHuspy } from "../actions";
import s from "../huspy.module.css";

export const metadata: Metadata = { title: "Huspy · Resultados" };
export const dynamic = "force-dynamic";

// Pantalla interna de resultados (nombre + nota + fecha). Ruta pública igual que
// /huspy, pensada para que el coordinador la consulte (no está enlazada desde la
// actividad). También puedes ver la tabla huspy_resultados directo en Supabase.
export default async function ResultadosPage() {
  const res = await listarResultadosHuspy();

  return (
    <div className={s.root}>
      <div className={s.shell}>
        <div className={s.brandBar}>
          <div className={s.brand}>
            <div className={s.logo}>H</div>
            <div>
              <div className={s.brandName}>Huspy · Resultados</div>
              <div className={s.brandSub}>Jornada de formación</div>
            </div>
          </div>
        </div>

        <div className={s.card}>
          <h2 className={s.sectionTitle}>Resultados de las asesoras</h2>
          <p className={s.sectionSub}>Nombre, nota final y fecha de cada jornada completada.</p>

          {!res.ok ? (
            <div className={`${s.banner} ${s.bannerBad}`}>No se pudieron cargar los resultados: {res.error}</div>
          ) : res.filas.length === 0 ? (
            <div className={`${s.banner} ${s.bannerInfo}`}>Aún no hay resultados registrados.</div>
          ) : (
            <div className={s.summary}>
              <div className={s.sumRow} style={{ fontWeight: 800 }}>
                <span style={{ color: "var(--ink)" }}>Asesora</span>
                <b>Nota</b>
                <b style={{ minWidth: 150 }}>Fecha</b>
              </div>
              {res.filas.map((f, i) => (
                <div key={i} className={s.sumRow}>
                  <span style={{ color: "var(--ink)", fontWeight: 700 }}>{f.nombre}</span>
                  <b style={{ color: f.nota >= 80 ? "var(--ok)" : f.nota >= 60 ? "var(--amber)" : "var(--bad)" }}>{f.nota}%</b>
                  <b style={{ minWidth: 150, fontWeight: 500, color: "var(--muted)" }}>
                    {new Date(f.creado_en).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })}
                  </b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
