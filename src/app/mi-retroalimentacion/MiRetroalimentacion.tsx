"use client";

import { useState } from "react";
import { CheckCircle2, PenLine, Loader2, ThumbsUp, Target, ShieldCheck } from "lucide-react";
import type { ResumenParaFirma } from "@/lib/resumen-diario";
import { firmarMiResumenAction } from "./actions";

export default function MiRetroalimentacion({ nombre, inicial }: { nombre: string; inicial: ResumenParaFirma | null }) {
  const [resumen, setResumen] = useState<ResumenParaFirma | null>(inicial);
  const [compromiso, setCompromiso] = useState("");
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState("");

  const wrap: React.CSSProperties = {
    minHeight: "100dvh", background: "linear-gradient(180deg,#f6f4ff,#eef1ff)", padding: "32px 16px",
    fontFamily: "var(--font-inter), system-ui, sans-serif", color: "#0e0a2a",
  };
  const card: React.CSSProperties = {
    maxWidth: 640, margin: "0 auto", background: "#fff", borderRadius: 18,
    boxShadow: "0 20px 50px rgba(14,10,42,.1)", padding: 28,
  };

  if (!resumen) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          <ShieldCheck size={44} color="#5b2eff" />
          <h2 style={{ margin: "12px 0 6px" }}>Hola, {nombre}</h2>
          <p style={{ color: "#6b6a85" }}>Por ahora no tienes retroalimentación de calidad pendiente de firmar. ¡Buen trabajo! 🎉</p>
        </div>
      </div>
    );
  }

  async function firmar() {
    if (!resumen) return;
    setError("");
    if (!compromiso.trim()) { setError("Escribe tu compromiso de mejora antes de firmar."); return; }
    setFirmando(true);
    const res = await firmarMiResumenAction(resumen.fecha, compromiso.trim());
    setFirmando(false);
    if (res.ok) setResumen({ ...resumen, firmado: true, compromiso: compromiso.trim(), firmadoEn: new Date().toISOString() });
    else setError(res.error || "No se pudo firmar.");
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#5b2eff,#3f12cf)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>Du</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Tu retroalimentación de calidad</div>
            <div style={{ fontSize: 13, color: "#6b6a85" }}>{resumen.fecha} · {resumen.numAuditorias} auditoría(s) · calidad {resumen.promedioNota}%</div>
          </div>
        </div>

        <p style={{ margin: "14px 0 4px" }}>Hola <b>{nombre}</b>, este es el resumen de tus auditorías del día:</p>

        <div style={{ background: "#e7f7ee", border: "1px solid #bfe8cf", borderRadius: 12, padding: "14px 16px", margin: "12px 0" }}>
          <b style={{ color: "#0f7a37", display: "flex", alignItems: "center", gap: 6 }}><ThumbsUp size={16} /> Lo positivo</b>
          <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>{resumen.positivo}</p>
        </div>
        <div style={{ background: "#fff7e6", border: "1px solid #ffe2a8", borderRadius: 12, padding: "14px 16px", margin: "12px 0" }}>
          <b style={{ color: "#8a5a00", display: "flex", alignItems: "center", gap: 6 }}><Target size={16} /> Para mejorar</b>
          <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>{resumen.mejorar}</p>
        </div>

        {resumen.firmado ? (
          <div style={{ background: "#e7f7ee", border: "1px solid #bfe8cf", borderRadius: 12, padding: "16px", marginTop: 16, textAlign: "center" }}>
            <CheckCircle2 size={34} color="#16a34a" />
            <h3 style={{ margin: "8px 0 4px" }}>¡Firmado! ✅</h3>
            <p style={{ color: "#0f7a37", margin: 0 }}>Gracias por tu compromiso. Quedó registrado tu acuse de recibo.</p>
            {resumen.compromiso && (
              <p style={{ marginTop: 10, fontSize: 14, color: "#2f2f2f" }}><b>Tu compromiso:</b> “{resumen.compromiso}”</p>
            )}
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#4b4b63", margin: "18px 0 6px" }}>
              Mi compromiso de mejora (una sola vez, para todo el día)
            </label>
            <textarea
              value={compromiso}
              onChange={(e) => setCompromiso(e.target.value)}
              rows={3}
              placeholder="Ej.: Me comprometo a invitar siempre a la encuesta en el cierre y a dar manejo a cada caso."
              style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e7e4f5", borderRadius: 12, padding: "11px 13px", fontSize: 14.5, fontFamily: "inherit", resize: "vertical" }}
            />
            {error && <div style={{ color: "#e11d48", fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button
              onClick={firmar}
              disabled={firmando}
              style={{ marginTop: 14, width: "100%", justifyContent: "center", cursor: firmando ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 9, border: "none", borderRadius: 14, padding: "13px 22px", fontSize: 15.5, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#16a34a,#0f8a3d)", opacity: firmando ? 0.6 : 1 }}
            >
              {firmando ? <Loader2 size={17} className="spin" /> : <PenLine size={17} />}
              Acuso recibo y firmo
            </button>
            <p style={{ fontSize: 12, color: "#8a93a8", textAlign: "center", marginTop: 10 }}>
              Con esta firma confirmas que leíste tu retroalimentación del día. Cubre todas tus auditorías de {resumen.fecha}.
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}
