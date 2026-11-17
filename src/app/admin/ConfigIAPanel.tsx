"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, CheckCircle2, AlertTriangle, Loader2, Plug, Bot } from "lucide-react";
import { obtenerConfigIAAction, guardarConfigIAAction, probarOpenAIAction } from "./actions";
import styles from "./auditorias.module.css";

const MODELOS = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (económico, recomendado)" },
  { id: "gpt-4o", label: "gpt-4o (más preciso, más caro)" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { id: "gpt-4.1", label: "gpt-4.1" },
];

export default function ConfigIAPanel({ onBanner }: { onBanner: (m: { tipo: "ok" | "error"; msg: string }) => void }) {
  const [cargando, setCargando] = useState(true);
  const [tieneKey, setTieneKey] = useState(false);
  const [keyMascara, setKeyMascara] = useState("");
  const [nuevaKey, setNuevaKey] = useState("");
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [motor, setMotor] = useState<"openai" | "claude">("claude");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; msg: string } | null>(null);

  async function cargar() {
    try {
      const c = await obtenerConfigIAAction();
      setTieneKey(c.tieneKey);
      setKeyMascara(c.keyMascara);
      setModelo(c.modelo);
      setMotor(c.motor);
    } catch {
      onBanner({ tipo: "error", msg: "No se pudo cargar la configuración de IA." });
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    setGuardando(true);
    setPrueba(null);
    const res = await guardarConfigIAAction({
      openaiKey: nuevaKey || undefined, // solo si escribieron una nueva
      modelo,
      motor,
    });
    setGuardando(false);
    if (res.ok) {
      setNuevaKey("");
      onBanner({ tipo: "ok", msg: "Configuración de IA guardada." });
      await cargar();
    } else {
      onBanner({ tipo: "error", msg: res.error });
    }
  }

  async function probar() {
    setProbando(true);
    setPrueba(null);
    try {
      const r = await probarOpenAIAction();
      setPrueba({ ok: r.ok, msg: r.mensaje });
    } finally {
      setProbando(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2><Bot size={18} /> Motor de auditoría con IA</h2>
      <p className={styles.gptHint} style={{ marginBottom: 14 }}>
        Elige con qué IA se auditan las transcripciones. Con <b>OpenAI</b> usas tu propio saldo
        (tu API key). La key se guarda cifrada en el servidor y <b>nunca</b> se muestra completa.
      </p>

      {cargando ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280" }}>
          <Loader2 size={16} className={styles.spin} /> Cargando configuración…
        </div>
      ) : (
        <>
          {/* Motor */}
          <div className={styles.formField}>
            <label>Motor</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className={motor === "openai" ? styles.primary : styles.secondary}
                onClick={() => setMotor("openai")}
              >
                OpenAI (tu saldo)
              </button>
              <button
                type="button"
                className={motor === "claude" ? styles.primary : styles.secondary}
                onClick={() => setMotor("claude")}
              >
                Claude (predeterminado del sistema)
              </button>
            </div>
          </div>

          {/* Modelo OpenAI */}
          <div className={styles.formField} style={{ marginTop: 12 }}>
            <label>Modelo de OpenAI</label>
            <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
              {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {/* API Key */}
          <div className={styles.formField} style={{ marginTop: 12 }}>
            <label><KeyRound size={13} style={{ verticalAlign: "-2px" }} /> API key de OpenAI</label>
            {tieneKey && (
              <div style={{ fontSize: 13, color: "#0f7a37", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={14} /> Hay una key guardada: <code>{keyMascara}</code>
              </div>
            )}
            <input
              type="password"
              value={nuevaKey}
              onChange={(e) => setNuevaKey(e.target.value)}
              placeholder={tieneKey ? "Escribe una nueva key para reemplazarla…" : "sk-…"}
              autoComplete="off"
              spellCheck={false}
            />
            <small style={{ color: "#6b7280" }}>
              La obtienes en platform.openai.com → API keys. Déjala vacía si no quieres cambiarla.
            </small>
          </div>

          {prueba && (
            <div className={`${styles.banner} ${prueba.ok ? styles.bannerOk : styles.bannerError}`} style={{ marginTop: 12 }}>
              {prueba.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {prueba.msg}
            </div>
          )}

          <div className={styles.formActions} style={{ marginTop: 16 }}>
            <button className={styles.secondary} onClick={probar} disabled={probando || guardando}>
              {probando ? <Loader2 size={14} className={styles.spin} /> : <Plug size={14} />} Probar conexión
            </button>
            <button className={styles.primary} onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />} Guardar configuración
            </button>
          </div>
        </>
      )}
    </section>
  );
}
