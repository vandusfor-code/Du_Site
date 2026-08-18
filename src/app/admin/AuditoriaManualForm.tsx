"use client";

import { useMemo, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { guardarAuditoriaManualAction } from "./actions";
import type { FuncionarioOpcion } from "@/lib/auditorias-admin";
import styles from "./auditorias.module.css";

const OPCIONES_CRITERIO = ["Cumple", "No cumple", "No aplica"] as const;
const OPCIONES_TUTEO = ["Sin tuteo", "Tuteo leve", "Tuteo real"] as const;

const CRITERIOS: { key: CriterioKey; label: string }[] = [
  { key: "saludo", label: "Saludo" },
  { key: "empatia", label: "Empatía" },
  { key: "sonrisa", label: "Sonrisa" },
  { key: "claridad", label: "Claridad" },
  { key: "encuesta", label: "Encuesta" },
  { key: "informacion", label: "Información" },
  { key: "proceso", label: "Proceso" },
  { key: "cierre", label: "Cierre" },
];

type CriterioKey = "saludo" | "empatia" | "sonrisa" | "claridad" | "encuesta" | "informacion" | "proceso" | "cierre";

function hoyIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function estadoInicial(evaluadorDefault: string) {
  return {
    fecha: hoyIso(),
    asesor: "",
    canal: "",
    tipoGestion: "Consulta",
    correo: "",
    idGestion: "",
    evaluador: evaluadorDefault,
    saludo: "Cumple",
    empatia: "Cumple",
    sonrisa: "Cumple",
    claridad: "Cumple",
    encuesta: "Cumple",
    informacion: "Cumple",
    proceso: "Cumple",
    cierre: "Cumple",
    observacion: "",
    hallazgos: "",
    mejora: "",
    estado: "Procesado",
    grabacion: "",
    tipoConsulta: "",
    puntajeTuteo: "Sin tuteo",
  };
}

// Misma fórmula que calcularNotaManual() en el servidor: como los <select> ya
// emiten valores canónicos ("Cumple"/"No cumple"/"No aplica") no hace falta
// repetir el parseo difuso de normalizar(), solo contar.
function calcularNotaPreview(f: ReturnType<typeof estadoInicial>): { nota: number; tipoNota: string } {
  const vals = [f.saludo, f.empatia, f.sonrisa, f.claridad, f.encuesta, f.cierre].filter((v) => v !== "No aplica");
  const total = vals.length;
  const cumple = vals.filter((v) => v === "Cumple").length;
  const noCumple = vals.filter((v) => v === "No cumple").length;
  if (noCumple > 2) return { nota: total > 0 ? Math.round((cumple / total) * 100) : 0, tipoNota: "PENC" };
  return { nota: 100, tipoNota: "OK" };
}

export default function AuditoriaManualForm({
  funcionarios,
  canales,
  evaluadorDefault,
  onGuardado,
}: {
  funcionarios: FuncionarioOpcion[];
  canales: string[];
  evaluadorDefault: string;
  onGuardado: (mensaje: { tipo: "ok" | "error"; msg: string }) => void;
}) {
  const [f, setF] = useState(estadoInicial(evaluadorDefault));
  const [guardando, setGuardando] = useState(false);

  const asesoresUnicos = useMemo(() => {
    const vistos = new Set<string>();
    return funcionarios.filter((x) => (vistos.has(x.asesor) ? false : (vistos.add(x.asesor), true)));
  }, [funcionarios]);

  const canalesUnicos = useMemo(() => Array.from(new Set(canales.filter(Boolean))), [canales]);

  const { nota, tipoNota } = calcularNotaPreview(f);
  const penc = tipoNota === "PENC";

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function onAsesorChange(valor: string) {
    const match = funcionarios.find((x) => x.asesor === valor);
    setF((prev) => ({
      ...prev,
      asesor: valor,
      correo: match ? match.correo : prev.correo,
      canal: match && !prev.canal ? match.canal : prev.canal,
    }));
  }

  async function guardar() {
    if (guardando) return;
    if (!f.asesor.trim() || !f.idGestion.trim()) {
      onGuardado({ tipo: "error", msg: "Asesor e ID de gestión son obligatorios." });
      return;
    }
    setGuardando(true);
    try {
      const res = await guardarAuditoriaManualAction(f);
      onGuardado({ tipo: "ok", msg: `Auditoría CO guardada para ${f.asesor} — Nota ${res.nota} (${res.tipoNota}).` });
      setF(estadoInicial(evaluadorDefault));
    } catch (e) {
      onGuardado({ tipo: "error", msg: e instanceof Error ? e.message : "No se pudo guardar la auditoría manual." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className={`${styles.panel} ${styles.manualForm}`}>
      <h2>Auditoría CO — Registro manual</h2>

      <datalist id="co-asesores">
        {asesoresUnicos.map((a) => <option key={a.asesor} value={a.asesor} />)}
      </datalist>
      <datalist id="co-canales">
        {canalesUnicos.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label>Asesor *</label>
          <input list="co-asesores" value={f.asesor} onChange={(e) => onAsesorChange(e.target.value)} placeholder="Nombre del asesor" />
        </div>
        <div className={styles.formField}>
          <label>Canal</label>
          <input list="co-canales" value={f.canal} onChange={(e) => set("canal", e.target.value)} placeholder="Llamada / Chat" />
        </div>
        <div className={styles.formField}>
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label>Tipo de gestión</label>
          <input value={f.tipoGestion} onChange={(e) => set("tipoGestion", e.target.value)} />
        </div>

        <div className={styles.formField}>
          <label>Correo corporativo</label>
          <input value={f.correo} onChange={(e) => set("correo", e.target.value)} placeholder="asesor@empresa.com" />
        </div>
        <div className={styles.formField}>
          <label>ID Gestión *</label>
          <input value={f.idGestion} onChange={(e) => set("idGestion", e.target.value)} placeholder="ID único" />
        </div>
        <div className={styles.formField}>
          <label>Evaluador</label>
          <input value={f.evaluador} onChange={(e) => set("evaluador", e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label>Puntaje tuteo</label>
          <select value={f.puntajeTuteo} onChange={(e) => set("puntajeTuteo", e.target.value)}>
            {OPCIONES_TUTEO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {CRITERIOS.map(({ key, label }) => (
          <div className={styles.formField} key={key}>
            <label>{label}</label>
            <select value={f[key]} onChange={(e) => set(key, e.target.value)}>
              {OPCIONES_CRITERIO.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}

        <div className={styles.formField}>
          <label>Estado</label>
          <input value={f.estado} onChange={(e) => set("estado", e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label>Grabación</label>
          <input value={f.grabacion} onChange={(e) => set("grabacion", e.target.value)} placeholder="Link (opcional)" />
        </div>
        <div className={styles.formField}>
          <label>Tipo de consulta</label>
          <input value={f.tipoConsulta} onChange={(e) => set("tipoConsulta", e.target.value)} placeholder="Motivo principal" />
        </div>
        <div className={styles.formField}>
          <label>Nota calculada</label>
          <div className={styles.notaPreview}>
            <b>{nota}%</b>
            <span className={penc ? styles.penc : styles.ok}>{tipoNota}</span>
          </div>
        </div>
      </div>

      <div className={styles.formGridText}>
        <div className={styles.formField}>
          <label>Observación</label>
          <textarea value={f.observacion} onChange={(e) => set("observacion", e.target.value)} rows={3} />
        </div>
        <div className={styles.formField}>
          <label>Hallazgos</label>
          <textarea value={f.hallazgos} onChange={(e) => set("hallazgos", e.target.value)} rows={3} />
        </div>
        <div className={styles.formField}>
          <label>Puntos de mejora</label>
          <textarea value={f.mejora} onChange={(e) => set("mejora", e.target.value)} rows={3} />
        </div>
      </div>

      <div className={styles.formActions}>
        <button className={styles.primary} onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
          Guardar auditoría
        </button>
      </div>
    </section>
  );
}
