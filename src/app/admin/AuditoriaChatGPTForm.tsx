"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, CheckCircle2, AlertTriangle, ClipboardList, Info } from "lucide-react";
import type { AuditoriaManualInput, FuncionarioOpcion } from "@/lib/auditorias-admin";
import { guardarAuditoriaChatGPTAction } from "./actions";
import {
  parseAuditoriaChatGPT,
  calcularNota,
  erroresDe,
  advertenciasDe,
  resolverAsesor,
  CRITERIOS,
  VALORES_CRITERIO,
  VALORES_TUTEO,
  type ResultadoParseo,
  type DatosImportados,
} from "@/lib/auditoria-chatgpt-contrato";
import styles from "./auditorias.module.css";

type Estado = "importar" | "validando" | "interpretada" | "guardado";

function fechaValida(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

// Validación de guardado sobre los datos EDITADOS. El asesor NO se edita aquí
// (viene del selector como fuente de verdad), pero se verifica que esté fijado.
function problemasDeGuardado(d: DatosImportados): string[] {
  const out: string[] = [];
  if (!d.asesor.trim()) out.push("Falta seleccionar el asesor.");
  if (!d.idGestion.trim()) out.push("Falta el ID de gestión.");
  if (!d.fecha.trim()) out.push("Falta la fecha.");
  else if (!fechaValida(d.fecha)) out.push("La fecha no es válida (AAAA-MM-DD).");
  for (const { id, label } of CRITERIOS) {
    const v = (d as unknown as Record<string, string>)[id];
    if (!(VALORES_CRITERIO as readonly string[]).includes(v)) out.push(`Criterio "${label}" sin valor válido.`);
  }
  return out;
}

export default function AuditoriaChatGPTForm({
  funcionarios,
  evaluadorDefault,
  onGuardado,
}: {
  funcionarios: FuncionarioOpcion[];
  evaluadorDefault: string;
  onGuardado: (mensaje: { tipo: "ok" | "error"; msg: string }) => void;
}) {
  const [estado, setEstado] = useState<Estado>("importar");
  const [asesorSel, setAsesorSel] = useState(""); // identificador oficial — se conserva entre importaciones
  const [raw, setRaw] = useState(""); // se conserva ante cualquier error
  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [datos, setDatos] = useState<DatosImportados | null>(null);
  const [avisoAsesor, setAvisoAsesor] = useState<string>(""); // discrepancia JSON vs selección
  const [guardando, setGuardando] = useState(false);
  const [guardadoMsg, setGuardadoMsg] = useState("");

  // Lista oficial de asesores (deduplicada), tal como la usa Auditoría CO.
  const asesoresUnicos = useMemo(() => {
    const vistos = new Set<string>();
    return funcionarios.filter((x) => (x.asesor && !vistos.has(x.asesor) ? (vistos.add(x.asesor), true) : false));
  }, [funcionarios]);

  const listaNoDisponible = asesoresUnicos.length === 0;
  const asesorInfo = useMemo(() => resolverAsesor(asesorSel, funcionarios), [asesorSel, funcionarios]);

  function interpretar() {
    if (listaNoDisponible) {
      onGuardado({ tipo: "error", msg: "No se pudo cargar la lista de asesores. No es posible importar hasta resolverlo." });
      return;
    }
    if (!asesorSel) {
      onGuardado({ tipo: "error", msg: "Selecciona primero el asesor." });
      return;
    }
    if (!raw.trim()) {
      onGuardado({ tipo: "error", msg: "Pega el bloque generado por ChatGPT antes de interpretar." });
      return;
    }
    setEstado("validando");
    // La interpretación es local y síncrona; un microdelay solo da feedback visual.
    setTimeout(() => {
      const r = parseAuditoriaChatGPT(raw);
      const oficial = resolverAsesor(asesorSel, funcionarios);
      // PRECEDENCIA: el asesor seleccionado es la fuente de verdad. El nombre del
      // JSON nunca sobrescribe; el correo se resuelve del registro oficial.
      const jsonAsesor = r.datos?.asesor?.trim() ?? "";
      if (r.datos && oficial) {
        r.datos.asesor = oficial.asesor;
        r.datos.correo = oficial.correo;
      }
      setAvisoAsesor(
        jsonAsesor && oficial && jsonAsesor !== oficial.asesor
          ? `El JSON traía el asesor "${jsonAsesor}", pero se conserva el seleccionado manualmente: "${oficial.asesor}".`
          : ""
      );
      setResultado(r);
      setDatos(r.datos);
      setEstado("interpretada");
    }, 150);
  }

  function editar<K extends keyof DatosImportados>(key: K, value: DatosImportados[K]) {
    setDatos((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // Nota en vivo según la regla oficial, recalculada con los datos editados.
  const notaViva = useMemo(() => {
    if (!datos) return null;
    return calcularNota({
      saludo: datos.saludo, empatia: datos.empatia, sonrisa: datos.sonrisa,
      claridad: datos.claridad, encuesta: datos.encuesta, cierre: datos.cierre,
    });
  }, [datos]);

  const problemas = datos ? problemasDeGuardado(datos) : ["Sin datos"];
  const puedeGuardar = estado === "interpretada" && problemas.length === 0 && !guardando;

  async function guardar() {
    if (!datos || guardando || !puedeGuardar) return;
    setGuardando(true);
    try {
      const input: AuditoriaManualInput = {
        fecha: datos.fecha,
        asesor: asesorSel, // fuente de verdad; el servidor lo revalida y resuelve el correo
        canal: datos.canal,
        tipoGestion: datos.tipoGestion,
        correo: asesorInfo?.correo ?? "",
        idGestion: datos.idGestion,
        evaluador: datos.evaluador || evaluadorDefault,
        saludo: datos.saludo,
        empatia: datos.empatia,
        sonrisa: datos.sonrisa,
        claridad: datos.claridad,
        encuesta: datos.encuesta,
        informacion: datos.informacion || "No aplica",
        proceso: datos.proceso || "No aplica",
        cierre: datos.cierre,
        observacion: datos.observacion,
        hallazgos: datos.hallazgos,
        mejora: datos.mejora,
        estado: datos.estado || "Procesado",
        grabacion: datos.grabacion,
        tipoConsulta: datos.tipoConsulta,
        puntajeTuteo: datos.puntajeTuteo || "Sin tuteo",
      };
      // El servidor revalida admin, verifica que el asesor exista, resuelve su
      // correo oficial, deduplica por ID y RECALCULA la nota oficial.
      const res = await guardarAuditoriaChatGPTAction(input);
      setGuardadoMsg(`Auditoría ChatGPT guardada para ${asesorSel} — Nota ${res.nota} (${res.tipoNota}).`);
      setEstado("guardado");
      onGuardado({ tipo: "ok", msg: `Auditoría ChatGPT guardada para ${asesorSel} — Nota ${res.nota} (${res.tipoNota}).` });
    } catch (e) {
      // Conserva el bloque, la selección y los datos para no obligar a pegar de nuevo.
      onGuardado({ tipo: "error", msg: e instanceof Error ? e.message : "No se pudo guardar la auditoría." });
    } finally {
      setGuardando(false);
    }
  }

  // Vuelve a importar SIN perder la selección de asesor.
  function volverAImportar() {
    setRaw("");
    setResultado(null);
    setDatos(null);
    setAvisoAsesor("");
    setGuardadoMsg("");
    setEstado("importar");
  }

  // ── Estado D: Guardado ──
  if (estado === "guardado") {
    return (
      <section className={`${styles.panel} ${styles.manualForm}`}>
        <h2><CheckCircle2 size={18} /> Auditoría ChatGPT</h2>
        <div className={styles.gptSuccess}>
          <CheckCircle2 size={34} />
          <p>{guardadoMsg || "Auditoría guardada correctamente."}</p>
          <button className={styles.primary} onClick={volverAImportar}>
            <ClipboardList size={16} /> Importar otra auditoría
          </button>
        </div>
      </section>
    );
  }

  // ── Estado A / B: Importar / Validando ──
  if (estado === "importar" || estado === "validando") {
    return (
      <section className={`${styles.panel} ${styles.manualForm}`}>
        <h2><ClipboardList size={18} /> Auditoría ChatGPT</h2>
        <p className={styles.gptHint}>
          Selecciona el asesor, pega el bloque generado por ChatGPT (formato <code>AUDITORIA_CO_V1</code>)
          y registra el resultado. El sistema lo interpreta sin volver a evaluar ni llamar a ninguna IA.
        </p>

        {listaNoDisponible && (
          <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginBottom: 12 }}>
            <b><AlertTriangle size={15} /> No se pudo cargar la lista de asesores.</b> Recarga la página o verifica
            el acceso a la hoja Funcionarios. No es posible importar hasta resolverlo.
          </div>
        )}

        {/* 1) Seleccionar asesor (obligatorio) */}
        <div className={styles.formField} style={{ marginBottom: 14, maxWidth: 420 }}>
          <label>Asesor * (selección manual — fuente de verdad)</label>
          <select value={asesorSel} onChange={(e) => setAsesorSel(e.target.value)} disabled={listaNoDisponible || estado === "validando"}>
            <option value="">— Selecciona un asesor —</option>
            {asesoresUnicos.map((a) => (
              <option key={a.asesor} value={a.asesor}>{a.asesor}{a.correo ? ` — ${a.correo}` : ""}</option>
            ))}
          </select>
        </div>

        {/* 2) Pegar JSON */}
        <div className={styles.formField}>
          <label>Bloque AUDITORIA_CO_V1</label>
          <textarea
            className={styles.gptTextarea}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
            placeholder={"Pega aquí el bloque JSON de la auditoría…"}
            disabled={estado === "validando"}
            spellCheck={false}
          />
        </div>

        {/* 3) Interpretar */}
        <div className={styles.formActions}>
          <button className={styles.primary} onClick={interpretar} disabled={estado === "validando" || listaNoDisponible || !asesorSel}>
            {estado === "validando" ? <Loader2 size={16} className={styles.spin} /> : <ClipboardList size={16} />}
            {estado === "validando" ? "Validando…" : "Interpretar auditoría"}
          </button>
        </div>
      </section>
    );
  }

  // ── Estado C: Auditoría interpretada (vista previa + corrección) ──
  const errores = resultado ? erroresDe(resultado) : [];
  const advertencias = resultado ? advertenciasDe(resultado) : [];
  const notaProp = resultado?.notaPropuesta ?? null;
  const clasifProp = resultado?.clasificacionPropuesta ?? null;

  return (
    <section className={`${styles.panel} ${styles.manualForm}`}>
      <h2><ClipboardList size={18} /> Auditoría ChatGPT — Revisión</h2>

      {/* Asesor seleccionado — claramente visible, no editable aquí */}
      <div className={styles.gptAsesor}>
        <span>Asesor</span>
        <b>{asesorSel || "—"}</b>
        {asesorInfo?.correo && <small>{asesorInfo.correo}</small>}
      </div>

      {avisoAsesor && (
        <div className={styles.gptWarn}>
          <b><Info size={15} /> {avisoAsesor}</b>
        </div>
      )}

      {errores.length > 0 && (
        <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginBottom: 12 }}>
          <b><AlertTriangle size={15} /> No se puede guardar todavía:</b>
          <ul className={styles.gptDiagList}>
            {errores.map((d, i) => <li key={i}>{d.campo}: {d.mensaje}</li>)}
          </ul>
        </div>
      )}
      {advertencias.length > 0 && (
        <div className={styles.gptWarn}>
          <b><Info size={15} /> Advertencias (no bloquean):</b>
          <ul className={styles.gptDiagList}>
            {advertencias.map((d, i) => <li key={i}>{d.campo}: {d.mensaje}</li>)}
          </ul>
        </div>
      )}

      {datos && (
        <>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>Canal</label>
              <input value={datos.canal} onChange={(e) => editar("canal", e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label>Fecha *</label>
              <input type="date" value={datos.fecha} onChange={(e) => editar("fecha", e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label>Tipo de gestión</label>
              <input value={datos.tipoGestion} onChange={(e) => editar("tipoGestion", e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label>Correo corporativo (oficial)</label>
              <input value={asesorInfo?.correo ?? ""} readOnly disabled title="Resuelto del registro del asesor" />
            </div>
            <div className={styles.formField}>
              <label>ID Gestión *</label>
              <input value={datos.idGestion} onChange={(e) => editar("idGestion", e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label>Evaluador</label>
              <input value={datos.evaluador} onChange={(e) => editar("evaluador", e.target.value)} placeholder={evaluadorDefault} />
            </div>
            <div className={styles.formField}>
              <label>Puntaje tuteo</label>
              <select value={datos.puntajeTuteo} onChange={(e) => editar("puntajeTuteo", e.target.value)}>
                {VALORES_TUTEO.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Tipo de consulta</label>
              <input value={datos.tipoConsulta} onChange={(e) => editar("tipoConsulta", e.target.value)} />
            </div>

            {CRITERIOS.map(({ id, label }) => (
              <div className={styles.formField} key={id}>
                <label>{label}</label>
                <select
                  value={(datos as unknown as Record<string, string>)[id] ?? ""}
                  onChange={(e) => editar(id as keyof DatosImportados, e.target.value)}
                >
                  <option value="" disabled>— sin valor —</option>
                  {VALORES_CRITERIO.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {resultado?.evidencias[id] && <small className={styles.gptEvidence}>“{resultado.evidencias[id]}”</small>}
              </div>
            ))}

            <div className={styles.formField}>
              <label>Grabación</label>
              <input value={datos.grabacion} onChange={(e) => editar("grabacion", e.target.value)} placeholder="Link (opcional)" />
            </div>
            <div className={styles.formField}>
              <label>Nota calculada (oficial)</label>
              <div className={styles.notaPreview}>
                <b>{notaViva?.nota ?? 0}%</b>
                <span className={notaViva?.tipoNota === "PENC" ? styles.penc : styles.ok}>{notaViva?.tipoNota ?? "—"}</span>
              </div>
            </div>
            {(notaProp !== null || clasifProp) && (
              <div className={styles.formField}>
                <label>Propuesta por ChatGPT (informativa)</label>
                <div className={styles.notaPreview}>
                  <b style={{ opacity: 0.7 }}>{notaProp ?? "—"}%</b>
                  <span style={{ opacity: 0.7 }}>{clasifProp ?? "—"}</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.formGridText}>
            <div className={styles.formField}>
              <label>Observación</label>
              <textarea value={datos.observacion} onChange={(e) => editar("observacion", e.target.value)} rows={3} />
            </div>
            <div className={styles.formField}>
              <label>Hallazgos</label>
              <textarea value={datos.hallazgos} onChange={(e) => editar("hallazgos", e.target.value)} rows={3} />
            </div>
            <div className={styles.formField}>
              <label>Puntos de mejora</label>
              <textarea value={datos.mejora} onChange={(e) => editar("mejora", e.target.value)} rows={3} />
            </div>
          </div>
        </>
      )}

      <div className={styles.formActions}>
        <button className={styles.secondary} onClick={volverAImportar} disabled={guardando}>
          Volver a importar
        </button>
        <button className={styles.primary} onClick={guardar} disabled={!puedeGuardar} title={problemas[0] ?? ""}>
          {guardando ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
          Guardar auditoría
        </button>
      </div>
    </section>
  );
}
