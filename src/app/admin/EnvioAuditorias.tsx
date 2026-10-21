"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, CalendarDays, Users, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { FuncionarioOpcion } from "@/lib/auditorias-admin";
import type { ResumenEnvio, GrupoAsesora } from "@/lib/envio-auditorias-tipos";
import type { ResultadoEnvioLote } from "@/lib/envio-auditorias";
import { obtenerEnvioAuditoriasAction, enviarLoteAuditoriasAction } from "./actions";
import styles from "./auditorias.module.css";

function hoyBogotaISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

interface Confirmacion {
  asesora?: string; // código, o undefined = todas
  nombre?: string;
  grupos: GrupoAsesora[]; // los que se enviarían
  totalAuditorias: number;
  correos: string[]; // enmascarados
  noElegibles: number;
}

function enmascarar(correo: string): string {
  const [u, dom] = correo.split("@");
  if (!dom) return "—";
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${dom}`;
}

export default function EnvioAuditorias({
  funcionarios,
  onBanner,
}: {
  funcionarios: FuncionarioOpcion[];
  onBanner: (m: { tipo: "ok" | "error"; msg: string }) => void;
}) {
  const [fecha, setFecha] = useState(hoyBogotaISO());
  const [asesora, setAsesora] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [resumen, setResumen] = useState<ResumenEnvio | null>(null);
  const [cargando, setCargando] = useState(true); // primera carga en curso
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvioLote | null>(null);

  const asesorasUnicas = (() => {
    const v = new Set<string>();
    return funcionarios.filter((f) => (f.asesor && !v.has(f.asesor) ? (v.add(f.asesor), true) : false));
  })();

  // Función reutilizable (botón "Actualizar" y tras un envío). En contexto de
  // manejador de evento, actualizar estado es correcto.
  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await obtenerEnvioAuditoriasAction({ fecha, asesora: asesora || undefined, soloPendientes });
      setResumen(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al consultar auditorías");
      setResumen(null);
    }
  }, [fecha, asesora, soloPendientes]);

  // Carga inicial y ante cambios de filtro — patrón con bandera de cancelación
  // (mismo que el dashboard): el setState ocurre dentro de .then/.finally
  // (asíncrono), no de forma síncrona en el cuerpo del efecto.
  useEffect(() => {
    let vigente = true;
    obtenerEnvioAuditoriasAction({ fecha, asesora: asesora || undefined, soloPendientes })
      .then((r) => { if (vigente) { setResumen(r); setError(null); setCargando(false); } })
      .catch((e) => { if (vigente) { setError(e instanceof Error ? e.message : "Error al consultar auditorías"); setResumen(null); setCargando(false); } });
    return () => { vigente = false; };
  }, [fecha, asesora, soloPendientes]);

  function pedirConfirmacion(grupoAsesora?: string) {
    if (!resumen) return;
    const grupos = grupoAsesora
      ? resumen.grupos.filter((g) => g.asesorCodigo === grupoAsesora && g.idsPendientesElegibles.length > 0)
      : resumen.grupos.filter((g) => g.idsPendientesElegibles.length > 0);
    if (grupos.length === 0) {
      onBanner({ tipo: "error", msg: "No hay auditorías pendientes elegibles para enviar con estos filtros." });
      return;
    }
    const totalAuditorias = grupos.reduce((s, g) => s + g.idsPendientesElegibles.length, 0);
    const correos = grupos.map((g) => (g.correo ? enmascarar(g.correo) : "—"));
    const noElegibles = grupos.reduce((s, g) => s + g.noElegibles, 0);
    setConfirmacion({
      asesora: grupoAsesora,
      nombre: grupoAsesora ? grupos[0]?.nombre : undefined,
      grupos,
      totalAuditorias,
      correos,
      noElegibles,
    });
  }

  async function confirmarEnvio() {
    if (!confirmacion || enviando) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await enviarLoteAuditoriasAction(fecha, confirmacion.asesora);
      setResultado(res);
      onBanner({
        tipo: res.fallidas > 0 ? "error" : "ok",
        msg: `Envío: ${res.asesorasNotificadas} asesora(s), ${res.auditoriasNotificadas} auditoría(s) notificada(s)${res.fallidas > 0 ? `, ${res.fallidas} con problemas` : ""}.`,
      });
      setConfirmacion(null);
      await cargar();
    } catch (e) {
      onBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al enviar" });
    } finally {
      setEnviando(false);
    }
  }

  const hayPendientesElegibles = (resumen?.grupos ?? []).some((g) => g.idsPendientesElegibles.length > 0);

  return (
    <section className={`${styles.panel} ${styles.manualForm}`}>
      <h2><Send size={18} /> Envío de auditorías</h2>
      <p className={styles.gptHint}>
        Filtra por fecha de registro, revisa las auditorías agrupadas por asesora y envíalas. Cada asesora recibe
        <b> un solo correo</b> con enlace al portal para consultar sus evaluaciones, confirmar recepción y registrar compromisos.
      </p>

      {/* Filtros */}
      <div className={styles.gptRow}>
        <div className={styles.formField}>
          <label><CalendarDays size={12} /> Fecha de registro</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label><Users size={12} /> Asesora</label>
          <select value={asesora} onChange={(e) => setAsesora(e.target.value)}>
            <option value="">Todas las asesoras</option>
            {asesorasUnicas.map((a) => (
              <option key={a.asesor} value={a.asesor}>{a.asesor}{a.nombre ? ` — ${a.nombre}` : ""}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.envioTools}>
        <label className={styles.envioCheck}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo pendientes de envío
        </label>
        <button className={styles.secondary} onClick={async () => { setCargando(true); await cargar(); setCargando(false); }} disabled={cargando}>
          {cargando ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />} Actualizar
        </button>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}

      {/* Resumen */}
      {resumen && (
        <div className={styles.envioResumen}>
          <div><b>{resumen.totalAuditorias}</b><span>Auditorías</span></div>
          <div><b>{resumen.totalAsesoras}</b><span>Asesoras</span></div>
          <div><b>{resumen.totalPendientes}</b><span>Pendientes</span></div>
          <div><b>{resumen.totalEnviadas}</b><span>Enviadas</span></div>
          <div><b>{resumen.totalNoElegibles}</b><span>No elegibles</span></div>
        </div>
      )}

      {/* Acción general */}
      <div className={styles.formActions} style={{ justifyContent: "space-between", alignItems: "center" }}>
        <small style={{ color: "#8a93a8" }}>No reenvía auditorías ya notificadas.</small>
        <button className={styles.primary} onClick={() => pedirConfirmacion()} disabled={enviando || cargando || !hayPendientesElegibles}>
          {enviando ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />} Enviar auditorías pendientes
        </button>
      </div>

      {/* Listado agrupado */}
      <div className={styles.envioLista}>
        {(resumen?.grupos ?? []).map((g) => (
          <div className={styles.envioGrupo} key={g.asesorCodigo}>
            <div className={styles.envioGrupoHead}>
              <div>
                <b>{g.nombre}</b>
                <span className={styles.envioCodigo}>{g.asesorCodigo}</span>
                {!g.enDirectorio && <span className={styles.envioAlerta}><AlertTriangle size={12} /> sin directorio</span>}
              </div>
              <button
                className={styles.secondary}
                onClick={() => pedirConfirmacion(g.asesorCodigo)}
                disabled={enviando || cargando || g.idsPendientesElegibles.length === 0}
              >
                <Send size={13} /> Enviar auditorías
              </button>
            </div>
            <div className={styles.envioGrupoMeta}>
              <span>{g.correo ? g.correo : <em className={styles.envioAlerta}>sin correo oficial</em>}</span>
              <span className={styles.envioBadges}>
                <b title="Total">{g.total}</b>
                <b className={styles.envioPend} title="Pendientes">{g.pendientes} pend.</b>
                <b className={styles.envioSent} title="Enviadas">{g.enviadas} env.</b>
                {g.noElegibles > 0 && <b className={styles.envioAlerta} title="No elegibles">{g.noElegibles} no eleg.</b>}
                <span className={styles.envioEstado}>{g.estadoNotificacion}</span>
              </span>
            </div>
          </div>
        ))}
        {resumen && resumen.grupos.length === 0 && !cargando && (
          <p className={styles.emptyMini}>No hay auditorías para esta fecha con los filtros seleccionados.</p>
        )}
      </div>

      {/* Resultado del último envío */}
      {resultado && (
        <div className={styles.envioResultado}>
          <h4><CheckCircle2 size={14} /> Resultado del envío</h4>
          <ul className={styles.gptDiagList}>
            {resultado.resultados.map((r) => (
              <li key={r.asesorCodigo}>
                <b>{r.nombre}</b> ({r.correoDestinoSeguro}) — {r.accion}
                {r.auditoriasEnviadas > 0 ? ` · ${r.auditoriasEnviadas} enviada(s)` : ""}
                {r.detalle ? ` · ${r.detalle}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmacion && (
        <div className={styles.overlay} onClick={() => !enviando && setConfirmacion(null)}>
          <div className={styles.modal} style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div><small>Confirmar envío</small><h3>{confirmacion.nombre ?? `${confirmacion.grupos.length} asesora(s)`}</h3></div>
            </div>
            <div className={styles.modalBody}>
              <p><b>Fecha:</b> {fecha}</p>
              <p><b>Asesoras:</b> {confirmacion.grupos.length} · <b>Auditorías a enviar:</b> {confirmacion.totalAuditorias}</p>
              <p><b>Correos de destino:</b></p>
              <ul className={styles.gptDiagList}>
                {confirmacion.correos.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {confirmacion.noElegibles > 0 && (
                <div className={styles.gptWarn}>
                  <b><AlertTriangle size={14} /> {confirmacion.noElegibles} registro(s) no elegible(s)</b> no se enviarán (sin ciclo o sin correo oficial).
                </div>
              )}
              <div className={styles.formActions} style={{ marginTop: 14 }}>
                <button className={styles.secondary} onClick={() => setConfirmacion(null)} disabled={enviando}>Cancelar</button>
                <button className={styles.primary} onClick={confirmarEnvio} disabled={enviando}>
                  {enviando ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />} Confirmar y enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
