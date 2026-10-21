"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, CheckCircle2, AlertTriangle, ClipboardList, Info, Copy } from "lucide-react";
import type { AuditoriaManualInput, FuncionarioOpcion } from "@/lib/auditorias-admin";
import { guardarAuditoriaChatGPTAction } from "./actions";
import {
  parseAuditoriaChatGPT,
  calcularNota,
  erroresDe,
  advertenciasDe,
  resolverAsesor,
  construirPromptUniversal,
  CRITERIOS,
  VALORES_CRITERIO,
  VALORES_TUTEO,
  type ResultadoParseo,
  type DatosImportados,
} from "@/lib/auditoria-chatgpt-contrato";
import styles from "./auditorias.module.css";

type Estado = "importar" | "validando" | "interpretada" | "guardado";

// Fecha de HOY en zona horaria de Colombia, en formato AAAA-MM-DD (en-CA → ISO).
function hoyBogotaISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function fechaValida(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
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
  // Datos administrativos controlados por el formulario (fuente de verdad), que
  // se conservan al volver a importar o ante errores de validación/guardado.
  const [asesorSel, setAsesorSel] = useState("");
  const [idGestionManual, setIdGestionManual] = useState("");
  const [fechaSel, setFechaSel] = useState(hoyBogotaISO());

  const [raw, setRaw] = useState("");
  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [datos, setDatos] = useState<DatosImportados | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]); // discrepancias JSON vs formulario
  const [guardando, setGuardando] = useState(false);
  const [guardadoMsg, setGuardadoMsg] = useState("");
  const [copiado, setCopiado] = useState<"ok" | "error" | null>(null);

  // Copia el prompt universal al portapapeles. NO altera el JSON, el asesor, el
  // ID ni la fecha. Usa la API de portapapeles con respaldo (execCommand).
  async function copiarPrompt() {
    const texto = construirPromptUniversal();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand falló");
      }
      setCopiado("ok");
    } catch {
      setCopiado("error");
    }
    setTimeout(() => setCopiado(null), 2500);
  }

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
    if (!idGestionManual.trim()) {
      onGuardado({ tipo: "error", msg: "Escribe el ID de gestión antes de interpretar." });
      return;
    }
    if (!raw.trim()) {
      onGuardado({ tipo: "error", msg: "Pega el bloque generado por ChatGPT antes de interpretar." });
      return;
    }
    setEstado("validando");
    setTimeout(() => {
      const r = parseAuditoriaChatGPT(raw);
      const oficial = resolverAsesor(asesorSel, funcionarios);

      // PRECEDENCIA: los datos administrativos del formulario mandan; el JSON nunca
      // los sobrescribe. Solo se leen los valores del JSON para avisar si difieren.
      const jsonAsesor = r.datos?.asesor?.trim() ?? "";
      const jsonId = r.datos?.idGestion?.trim() ?? "";
      const jsonFecha = r.datos?.fecha?.trim() ?? "";
      const jsonCanal = r.datos?.canal?.trim() ?? "";

      if (r.datos && oficial) {
        // Datos administrativos oficiales (del registro de Funcionarios y del
        // formulario). El JSON no los determina.
        r.datos.asesor = oficial.asesor;
        r.datos.correo = oficial.correo;
        r.datos.canal = oficial.canal;
        r.datos.idGestion = idGestionManual.trim();
        r.datos.fecha = fechaSel;
      }

      const nuevosAvisos: string[] = [];
      if (jsonAsesor && oficial && jsonAsesor !== oficial.asesor) {
        nuevosAvisos.push(`El JSON traía el asesor "${jsonAsesor}", pero se conserva el seleccionado: "${oficial.asesor}".`);
      }
      if (jsonId && jsonId !== idGestionManual.trim()) {
        nuevosAvisos.push(`El JSON traía el ID "${jsonId}", pero se conserva el escrito en Du Site: "${idGestionManual.trim()}".`);
      }
      if (jsonFecha && jsonFecha !== fechaSel) {
        nuevosAvisos.push(`El JSON traía la fecha "${jsonFecha}", pero se conserva la de registro: "${fechaSel}".`);
      }
      if (jsonCanal && oficial && jsonCanal.toLowerCase() !== oficial.canal.toLowerCase()) {
        nuevosAvisos.push(`El JSON traía el canal "${jsonCanal}", pero se usa el oficial del asesor: "${oficial.canal || "—"}".`);
      }
      setAvisos(nuevosAvisos);
      setResultado(r);
      setDatos(r.datos);
      setEstado("interpretada");
    }, 150);
  }

  function editar<K extends keyof DatosImportados>(key: K, value: DatosImportados[K]) {
    setDatos((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const notaViva = useMemo(() => {
    if (!datos) return null;
    return calcularNota({
      saludo: datos.saludo, empatia: datos.empatia, sonrisa: datos.sonrisa,
      claridad: datos.claridad, encuesta: datos.encuesta, cierre: datos.cierre,
    });
  }, [datos]);

  // Validación de guardado: datos administrativos (del formulario) + criterios (del JSON).
  const problemas: string[] = [];
  if (!asesorSel.trim()) problemas.push("Falta seleccionar el asesor.");
  if (!idGestionManual.trim()) problemas.push("Falta el ID de gestión.");
  if (!fechaValida(fechaSel)) problemas.push("La fecha no es válida (AAAA-MM-DD).");
  if (datos) {
    for (const { id, label } of CRITERIOS) {
      const v = (datos as unknown as Record<string, string>)[id];
      if (!(VALORES_CRITERIO as readonly string[]).includes(v)) problemas.push(`Criterio "${label}" sin valor válido.`);
    }
  } else {
    problemas.push("Sin datos interpretados.");
  }
  const puedeGuardar = estado === "interpretada" && problemas.length === 0 && !guardando;

  async function guardar() {
    if (!datos || guardando || !puedeGuardar) return;
    setGuardando(true);
    try {
      const input: AuditoriaManualInput = {
        fecha: fechaSel, // fecha de registro de Du Site (hoy Bogotá por defecto)
        asesor: asesorSel, // fuente de verdad; el servidor revalida y resuelve correo/canal
        canal: asesorInfo?.canal ?? "", // canal OFICIAL del registro (no del JSON)
        tipoGestion: datos.tipoGestion,
        correo: asesorInfo?.correo ?? "",
        idGestion: idGestionManual.trim(), // ID manual de Du Site (fuente de verdad)
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
      const res = await guardarAuditoriaChatGPTAction(input);
      setGuardadoMsg(`Auditoría ChatGPT guardada para ${asesorSel} — Nota ${res.nota} (${res.tipoNota}).`);
      setEstado("guardado");
      onGuardado({ tipo: "ok", msg: `Auditoría ChatGPT guardada para ${asesorSel} — Nota ${res.nota} (${res.tipoNota}).` });
    } catch (e) {
      // Conserva bloque, asesor, ID y fecha para no obligar a reescribir.
      onGuardado({ tipo: "error", msg: e instanceof Error ? e.message : "No se pudo guardar la auditoría." });
    } finally {
      setGuardando(false);
    }
  }

  // Volver a importar SIN perder asesor, ID ni fecha.
  function volverAImportar() {
    setRaw("");
    setResultado(null);
    setDatos(null);
    setAvisos([]);
    setGuardadoMsg("");
    setEstado("importar");
  }

  // Nueva auditoría tras guardar: conserva asesor y fecha; limpia el ID (cada
  // interacción tiene uno distinto) para no chocar con la protección de duplicados.
  function nuevaAuditoria() {
    setIdGestionManual("");
    volverAImportar();
  }

  // ── Estado D: Guardado ──
  if (estado === "guardado") {
    return (
      <section className={`${styles.panel} ${styles.manualForm}`}>
        <h2><CheckCircle2 size={18} /> Auditoría ChatGPT</h2>
        <div className={styles.gptSuccess}>
          <CheckCircle2 size={34} />
          <p>{guardadoMsg || "Auditoría guardada correctamente."}</p>
          <button className={styles.primary} onClick={nuevaAuditoria}>
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
          Selecciona el asesor y escribe el ID de gestión, pega el bloque generado por ChatGPT
          (formato <code>AUDITORIA_CO_V1</code>) y registra el resultado. El sistema lo interpreta
          sin volver a evaluar ni llamar a ninguna IA.
        </p>

        {listaNoDisponible && (
          <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginBottom: 12 }}>
            <b><AlertTriangle size={15} /> No se pudo cargar la lista de asesores.</b> Recarga la página o verifica
            el acceso a la hoja Funcionarios. No es posible importar hasta resolverlo.
          </div>
        )}

        {/* 1) Asesor + ID de gestión en la misma fila (responsive) */}
        <div className={styles.gptRow}>
          <div className={styles.formField}>
            <label>Asesor * (selección manual — fuente de verdad)</label>
            <select value={asesorSel} onChange={(e) => setAsesorSel(e.target.value)} disabled={listaNoDisponible || estado === "validando"}>
              <option value="">— Selecciona un asesor —</option>
              {asesoresUnicos.map((a) => (
                <option key={a.asesor} value={a.asesor}>{a.asesor}{a.nombre ? ` — ${a.nombre}` : a.correo ? ` — ${a.correo}` : ""}</option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label>ID Gestión * (identificador real de la interacción)</label>
            <input
              value={idGestionManual}
              onChange={(e) => setIdGestionManual(e.target.value)}
              placeholder="ID único de la gestión"
              disabled={estado === "validando"}
            />
          </div>
        </div>

        {/* 2) Pegar JSON */}
        <div className={styles.formField}>
          <div className={styles.gptTextareaHead}>
            <label>Bloque AUDITORIA_CO_V1</label>
            <button type="button" className={styles.gptCopyBtn} onClick={copiarPrompt}>
              {copiado === "ok" ? <CheckCircle2 size={14} /> : copiado === "error" ? <AlertTriangle size={14} /> : <Copy size={14} />}
              {copiado === "ok" ? "¡Prompt copiado!" : copiado === "error" ? "No se pudo copiar" : "Copiar prompt universal"}
            </button>
          </div>
          <textarea
            className={styles.gptTextarea}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={11}
            placeholder={"Pega aquí el bloque JSON de la auditoría…"}
            disabled={estado === "validando"}
            spellCheck={false}
          />
        </div>

        {/* 3) Interpretar */}
        <div className={styles.formActions}>
          <button
            className={styles.primary}
            onClick={interpretar}
            disabled={estado === "validando" || listaNoDisponible || !asesorSel || !idGestionManual.trim()}
          >
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

      {/* Datos administrativos oficiales (fuente de verdad) claramente visibles */}
      <div className={styles.gptAsesor}>
        <span>Asesor</span>
        <b>{asesorSel || "—"}</b>
        {asesorInfo?.nombre && <small>{asesorInfo.nombre}</small>}
        <span>Canal</span>
        <b>{asesorInfo?.canal || "—"}</b>
        <span style={{ marginLeft: "auto" }}>ID gestión</span>
        <b>{idGestionManual || "—"}</b>
      </div>

      {avisos.length > 0 && (
        <div className={styles.gptWarn}>
          <b><Info size={15} /> Se conservaron los datos de Du Site:</b>
          <ul className={styles.gptDiagList}>
            {avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
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
              <label>Fecha de registro *</label>
              <input type="date" value={fechaSel} onChange={(e) => setFechaSel(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label>ID Gestión (de Du Site)</label>
              <input value={idGestionManual} readOnly disabled title="Se define en la pantalla de importación" />
            </div>
            <div className={styles.formField}>
              <label>Correo corporativo (oficial)</label>
              <input value={asesorInfo?.correo ?? ""} readOnly disabled title="Resuelto del registro del asesor" />
            </div>
            <div className={styles.formField}>
              <label>Canal (oficial)</label>
              <input value={asesorInfo?.canal ?? ""} readOnly disabled title="Resuelto del registro del asesor (no del JSON)" />
            </div>
            <div className={styles.formField}>
              <label>Tipo de gestión</label>
              <input value={datos.tipoGestion} onChange={(e) => editar("tipoGestion", e.target.value)} />
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
