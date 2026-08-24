"use client";

import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/bold";
import "./metricas.css";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  type ChartConfiguration,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { cargarAuditoriasAction, guardarCompromisoAction } from "./actions";
import type { AuditoriaConEstado, MetricasAsesor } from "@/lib/metricas";
import { useModuleSound } from "@/lib/use-module-sound";
import { useToast } from "@/lib/use-toast";
import { ModuleTopbar, Toast } from "@/components/module-shell";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  ChartDataLabels
);

const ICONS: Record<string, string> = {
  PEC: "ph-star",
  PENC: "ph-check-circle",
  "Satisfacción": "ph-heart",
  Productividad: "ph-lightning",
  Adherencia: "ph-timer",
  "Auditorías": "ph-magnifying-glass",
  "PQRSF Creados": "ph-file-plus",
  "PQRSF Devueltos": "ph-file-x",
  "Calidad de la llamada": "ph-phone",
  "Precisión Ortográfica": "ph-text-aa",
  "Error de Respuesta": "ph-warning",
  Radicados: "ph-folders",
  SNC: "ph-clipboard-text",
  "SNC Recibidos": "ph-tray-arrow-down",
  "Cant. Radicados": "ph-stack",
  "Por Corrección": "ph-pencil-simple",
  "SNC Solucionados": "ph-check-square",
  "Gest.": "ph-headset",
  "% Ans Rate": "ph-phone-call",
  ATT: "ph-chats",
  Missed: "ph-phone-disconnect",
  Hold: "ph-hourglass",
  ACW: "ph-keyboard",
  AHT: "ph-clock-countdown",
  Meta: "ph-target",
};

const TIME_LABELS = new Set(["ATT", "Hold", "ACW", "AHT"]);

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const META_BONO = 300000;

function extractNumericPercent(value: string): number {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  return Number(cleaned) || 0;
}

export default function MetricasDashboard({
  nombre,
  datos,
  seccionInicial,
  idResaltado,
}: {
  nombre: string;
  datos: MetricasAsesor;
  // Deep-link desde el correo de notificación (?seccion=auditorias&id=...):
  // abre directo en "Auditorías Recibidas" y resalta la auditoría puntual.
  seccionInicial?: "auditorias";
  idResaltado?: string;
}) {
  const [seccion, setSeccion] = useState<"panel" | "auditorias">(seccionInicial ?? "panel");
  const [auditorias, setAuditorias] = useState<AuditoriaConEstado[] | null>(null);
  const cargandoRef = useRef(false);
  const resaltadoAplicadoRef = useRef(false);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { soundOn, toggleSound, playClick, playNotify } = useModuleSound();
  const { toast, showToast } = useToast();

  const barraRef = useRef<HTMLDivElement>(null);
  const chartMainRef = useRef<HTMLCanvasElement>(null);
  const chartPqrsfRef = useRef<HTMLCanvasElement>(null);
  const chartMainInstance = useRef<Chart | null>(null);
  const chartPqrsfInstance = useRef<Chart | null>(null);

  const mesActual = MESES[new Date().getMonth()];
  const pct = Math.max(0, Math.min(100, (datos.bonoGanado / META_BONO) * 100));

  useEffect(() => {
    const t = setTimeout(() => {
      if (barraRef.current) barraRef.current.style.width = `${pct}%`;
    }, 100);
    return () => clearTimeout(t);
  }, [pct]);

  useEffect(() => {
    if (seccion !== "auditorias" || auditorias !== null || cargandoRef.current) return;
    cargandoRef.current = true;
    cargarAuditoriasAction()
      .then(setAuditorias)
      .finally(() => {
        cargandoRef.current = false;
      });
  }, [seccion, auditorias]);

  // Deep-link: cuando la lista termina de cargar, si venimos con ?id=...
  // llevamos la vista hasta esa auditoría (el resaltado visual lo da la
  // clase "resaltada" en el render, comparando contra idResaltado).
  useEffect(() => {
    if (!idResaltado || !auditorias || resaltadoAplicadoRef.current) return;
    resaltadoAplicadoRef.current = true;
    const nodo = document.getElementById(`auditoria-${idResaltado}`);
    if (nodo) {
      const t = setTimeout(() => nodo.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      return () => clearTimeout(t);
    }
  }, [auditorias, idResaltado]);

  useEffect(() => {
    if (!chartMainRef.current) return;
    const labels: string[] = [];
    const values: number[] = [];
    datos.metrics.forEach((m) => {
      if (m.value.includes("%")) {
        labels.push(m.label);
        values.push(extractNumericPercent(m.value));
      }
    });

    chartMainInstance.current?.destroy();
    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: labels.map(() => 100),
            backgroundColor: "rgba(241,245,249,0.6)",
            borderRadius: 10,
            barThickness: 26,
            datalabels: { display: false },
          },
          {
            data: values,
            backgroundColor: (c) => {
              const ctx = c.chart.ctx;
              const area = c.chart.chartArea;
              if (!area) return "#CCFF00";
              const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
              if ((c.dataIndex ?? 0) % 2 === 0) {
                gradient.addColorStop(0, "#1A1535");
                gradient.addColorStop(1, "#3D3470");
              } else {
                gradient.addColorStop(0, "#9FCC00");
                gradient.addColorStop(1, "#CCFF00");
              }
              return gradient;
            },
            borderRadius: 10,
            barThickness: 26,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1200,
          easing: "easeOutQuart",
          delay: (context) => (context.dataIndex ?? 0) * 100,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#2B234F",
            titleFont: { weight: "bold", size: 12 },
            bodyFont: { weight: "bold", size: 11 },
            padding: 12,
            cornerRadius: 10,
            displayColors: false,
            callbacks: { label: (ctx) => `${ctx.parsed.y}%` },
          },
          datalabels: {
            anchor: "end",
            align: "top",
            color: "#2B234F",
            font: { weight: "bold", size: 11 },
            formatter: (v: number) => `${v.toFixed(1)}%`,
          },
        },
        scales: {
          y: { display: false, beginAtZero: true, max: 120 },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { weight: "bold", size: 10 }, color: "#94a3b8", maxRotation: 45, minRotation: 0 },
          },
        },
      },
    };
    chartMainInstance.current = new Chart(chartMainRef.current, config);

    return () => {
      chartMainInstance.current?.destroy();
      chartMainInstance.current = null;
    };
  }, [datos.metrics]);

  const pqrsfCre = datos.metrics.find((m) => m.label === "PQRSF Creados");
  const pqrsfDev = datos.metrics.find((m) => m.label === "PQRSF Devueltos");

  useEffect(() => {
    if (!chartPqrsfRef.current) return;
    if (!pqrsfCre && !pqrsfDev) {
      chartPqrsfInstance.current?.destroy();
      chartPqrsfInstance.current = null;
      return;
    }
    const creados = Number(pqrsfCre?.value || 0);
    const devueltos = Number(pqrsfDev?.value || 0);
    const total = creados + devueltos;

    chartPqrsfInstance.current?.destroy();
    const config: ChartConfiguration<"doughnut"> = {
      type: "doughnut",
      data: {
        labels: ["Creados", "Devueltos"],
        datasets: [
          {
            data: [creados, devueltos],
            backgroundColor: ["#CCFF00", "#2B234F"],
            borderWidth: 0,
          },
        ],
      },
      plugins: [
        {
          id: "centerText",
          beforeDraw(chart) {
            const {
              ctx,
              chartArea: { width, height, top, left },
            } = chart;
            ctx.save();
            ctx.font = "800 28px 'Inter', sans-serif";
            ctx.fillStyle = "#2B234F";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(total), left + width / 2, top + height / 2 - 8);
            ctx.font = "600 11px 'Inter', sans-serif";
            ctx.fillStyle = "#94A3B8";
            ctx.fillText("TOTAL", left + width / 2, top + height / 2 + 14);
            ctx.restore();
          },
        },
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "78%",
        animation: { animateRotate: true, duration: 1400, easing: "easeOutQuart" },
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { weight: "bold", size: 11 }, color: "#2B234F", usePointStyle: true, pointStyle: "rectRounded", padding: 20 },
          },
          tooltip: { backgroundColor: "#2B234F", padding: 12, cornerRadius: 10 },
          datalabels: {
            color: (c) => (c.dataIndex === 0 ? "#2B234F" : "#fff"),
            font: { weight: "bold", size: 13 },
            formatter: (v: number) => v,
          },
        },
      },
    };
    chartPqrsfInstance.current = new Chart(chartPqrsfRef.current, config);

    return () => {
      chartPqrsfInstance.current?.destroy();
      chartPqrsfInstance.current = null;
    };
  }, [pqrsfCre, pqrsfDev]);

  const pendientes = auditorias?.filter((a) => !a.comprometido).length ?? 0;
  const completadas = auditorias?.filter((a) => a.comprometido).length ?? 0;

  function enviarCompromiso(item: AuditoriaConEstado) {
    const comentario = (comentarios[item.idGestion] ?? "").trim();
    if (!comentario) {
      setErrorId(item.idGestion);
      setTimeout(() => setErrorId(null), 2500);
      return;
    }
    setGuardandoId(item.idGestion);
    startTransition(async () => {
      const resultado = await guardarCompromisoAction(item.idGestion, item.fecha, comentario);
      if (resultado === "OK" || resultado === "YA_EXISTE") {
        playNotify();
        showToast("Compromiso firmado correctamente");
        const actualizadas = await cargarAuditoriasAction();
        setAuditorias(actualizadas);
      } else {
        showToast("Error al guardar. Intenta de nuevo.");
      }
      setGuardandoId(null);
    });
  }

  return (
    <div className="metricas-scope">
      <ModuleTopbar moduleName="Métricas" soundOn={soundOn} toggleSound={toggleSound} />
      <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-text-main">People BPO</span>
          <span className="brand-text-sub">Métricas</span>
        </div>
        <nav className="sidebar-menu">
          <div
            className={`menu-item ${seccion === "panel" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setSeccion("panel");
            }}
          >
            <i className="ph ph-squares-four" /> Panel Principal
          </div>
          <div
            className={`menu-item ${seccion === "auditorias" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setSeccion("auditorias");
            }}
          >
            <i className="ph ph-clipboard-text" /> Auditorías
            {pendientes > 0 && <span className="badge-pendientes">{pendientes}</span>}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" className="menu-item logout-btn">
            <i className="ph ph-sign-out" /> Volver al inicio
          </Link>
          <div className="sidebar-footer">
            <p>V4.0 PREMIUM</p>
            <p className="signature">By Duvan Ramos</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header animate-fade">
          <div className="user-info">
            <h2>Hola, {nombre} 👋</h2>
            <div className="user-info-sub">
              <p>{datos.area || "Sin área asignada"}</p>
              <span className="badge-month">
                <i className="ph ph-calendar-blank" style={{ fontSize: 13 }} /> Mes {mesActual}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <div className="profile-trigger">
              <div className="profile-trigger-info">
                <div className="profile-trigger-name-row">
                  <span className="profile-trigger-name">{nombre}</span>
                  <i className="ph ph-caret-down" style={{ fontSize: 14, color: "var(--text-muted)" }} />
                </div>
                <span className="profile-trigger-role">
                  <span className="online-dot" /> En línea · Asesor Pro
                </span>
              </div>
              <div className="profile-trigger-avatar">
                <Image src="https://i.pravatar.cc/150?img=32" alt="Usuario" width={46} height={46} />
              </div>
            </div>
          </div>
        </header>

        {seccion === "panel" && (
          <div>
            {!datos.sinBono && (
              <section className="bono-hero animate-fade" style={{ animationDelay: "0.1s" }}>
                <div className="bono-info-row">
                  <div>
                    <p className="bono-label">Progreso del Bono (Mes Actual)</p>
                    <h1 className="bono-amount">${datos.bonoGanado.toLocaleString("es-CO")}</h1>
                  </div>
                  <div className="bono-meta-text">Meta: ${META_BONO.toLocaleString("es-CO")}</div>
                </div>
                <div className="progress-container">
                  <div className="progress-track">
                    <div className="progress-fill" ref={barraRef} style={{ width: 0 }} />
                  </div>
                </div>
              </section>
            )}

            <section className="metric-grid animate-fade" style={{ animationDelay: "0.2s" }}>
              {datos.metrics.map((m, i) => (
                <div
                  key={m.label}
                  className="metric-card"
                  style={{ animationDelay: `${0.2 + i * 0.05}s`, animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
                >
                  <div className="icon-box">
                    <i className={`ph-bold ${ICONS[m.label] || "ph-chart-line"}`} />
                  </div>
                  <div className="metric-info">
                    <p>{m.label}</p>
                    <p>
                      {m.value}
                      {TIME_LABELS.has(m.label) && <span className="mts-suffix">Mts</span>}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            <div className="charts-row animate-fade" style={{ animationDelay: "0.3s" }}>
              <div className="premium-card">
                <div className="card-header">
                  <h3>Métricas de Calidad</h3>
                  <span className="badge">Período actual</span>
                </div>
                <div className="chart-container">
                  <canvas ref={chartMainRef} />
                </div>
              </div>
              {(pqrsfCre || pqrsfDev) && (
                <div className="premium-card">
                  <div className="card-header">
                    <h3>Distribución PQRSF</h3>
                  </div>
                  <div className="chart-container">
                    <canvas ref={chartPqrsfRef} />
                  </div>
                </div>
              )}
            </div>

            <div className="bottom-row animate-fade" style={{ animationDelay: "0.4s" }}>
              {!datos.sinBono && (
                <div className="premium-card">
                  <div className="card-header">
                    <h3>Historial de Bonos</h3>
                    <i className="ph ph-clock-counter-clockwise" style={{ fontSize: 20, color: "#cbd5e1" }} />
                  </div>
                  <div className="history-list">
                    {datos.historialBono.length === 0 ? (
                      <p style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>
                        Sin historial de bonos.
                      </p>
                    ) : (
                      datos.historialBono.map((item, i) => {
                        const estadoLower = item.estado.toLowerCase();
                        const statusClass = estadoLower === "ganado" ? "status-ganado" : "status-pendiente";
                        return (
                          <div
                            key={i}
                            className="history-item"
                            style={{ animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.06}s` }}
                          >
                            <div className="hist-date">{item.fecha}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div className="hist-monto">${item.monto.toLocaleString("es-CO")}</div>
                              <div className={`status-tag ${statusClass}`}>{item.estado}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="premium-card">
                <div className="card-header">
                  <h3>Últimas Auditorías</h3>
                  <i className="ph ph-magnifying-glass-plus" style={{ fontSize: 20, color: "#cbd5e1" }} />
                </div>
                <div>
                  {datos.tablaData.length === 0 ? (
                    <p style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>
                      No hay auditorías recientes.
                    </p>
                  ) : (
                    datos.tablaData.slice(0, 5).map((item, i) => (
                      <div
                        key={i}
                        className="audit-item"
                        style={{ animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.06}s` }}
                      >
                        <div className="audit-meta">
                          <span>{item.fecha}</span>
                          <span className="badge" style={{ background: "rgba(185,226,43,0.1)", color: "#5d7a0e" }}>
                            {item.canal}
                          </span>
                        </div>
                        <div className="audit-content">
                          {item.tipoGestion} — ID: {item.idGestion}
                        </div>
                        <div className="audit-footer">{item.puntosMejora || "Sin puntos de mejora registrados."}</div>
                        {item.grabacion && (
                          <a href={item.grabacion} target="_blank" rel="noopener noreferrer" className="btn-grabacion">
                            <i className="ph ph-play-circle" /> Escuchar llamada
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {seccion === "auditorias" && (
          <div className="premium-card animate-fade">
            <div className="card-header">
              <div>
                <h3>Auditorías Recibidas</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginTop: 4 }}>
                  Revisa cada auditoría y deja tu compromiso de mejora
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontSize: 11, padding: "6px 14px" }}>
                  <i className="ph ph-clock" style={{ fontSize: 11 }} /> {pendientes} pendientes
                </span>
                <span className="badge" style={{ background: "rgba(185,226,43,0.15)", color: "#5d7a0e", fontSize: 11, padding: "6px 14px" }}>
                  <i className="ph ph-check-circle" style={{ fontSize: 11 }} /> {completadas} firmadas
                </span>
              </div>
            </div>

            {auditorias === null ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="spinner-small" />
                <p style={{ marginTop: 14, color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>Cargando auditorías...</p>
              </div>
            ) : auditorias.length === 0 ? (
              <p style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>
                No hay auditorías registradas.
              </p>
            ) : (
              auditorias.map((item, i) => (
                <div
                  key={item.idGestion + i}
                  id={`auditoria-${item.idGestion}`}
                  className={`audit-compromiso-card ${item.comprometido ? "firmada" : "pendiente"} ${
                    idResaltado && item.idGestion === idResaltado ? "resaltada" : ""
                  }`}
                  style={{ animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.05}s` }}
                >
                  <div className="auc-header">
                    <div className="auc-meta">
                      <span className="auc-fecha">{item.fecha}</span>
                      {item.comprometido ? (
                        <span className="badge" style={{ background: "rgba(185,226,43,0.15)", color: "#5d7a0e", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <i className="ph ph-check-circle" style={{ fontSize: 12 }} /> Firmada
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "#fef3c7", color: "#b45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <i className="ph ph-clock" style={{ fontSize: 12 }} /> Pendiente
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {item.grabacion && (
                        <a href={item.grabacion} target="_blank" rel="noopener noreferrer" className="btn-grabacion">
                          <i className="ph ph-play-circle" /> Escuchar llamada
                        </a>
                      )}
                      <span className="badge" style={{ background: "var(--bg-body)", color: "var(--text-muted)" }}>
                        {item.canal}
                      </span>
                    </div>
                  </div>
                  <div className="auc-tipo">
                    {item.tipoGestion} — ID: {item.idGestion}
                  </div>
                  <div className="auc-mejora">{item.puntosMejora || "Sin puntos de mejora registrados."}</div>

                  {item.comprometido ? (
                    <div className="auc-compromiso-firmado">
                      <i className="ph ph-seal-check" style={{ fontSize: 20, color: "#5d7a0e", flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#5d7a0e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                          Mi compromiso
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", lineHeight: 1.5 }}>
                          &quot;{item.comentario}&quot;
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                          <i className="ph ph-calendar-check" style={{ fontSize: 11 }} /> Firmado el {item.fechaCompromiso}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="auc-evaluador">
                        <i className="ph ph-user-circle" style={{ fontSize: 13 }} /> Evaluador: {item.evaluador || "No registrado"}
                      </div>
                      <div className="auc-input-row">
                        <textarea
                          className={`auc-textarea ${errorId === item.idGestion ? "auc-textarea-error" : ""}`}
                          placeholder={
                            errorId === item.idGestion
                              ? "⚠ Debes escribir un compromiso antes de confirmar."
                              : "Escribe tu compromiso de mejora... (máx. 300 caracteres)"
                          }
                          maxLength={300}
                          value={comentarios[item.idGestion] ?? ""}
                          onChange={(e) =>
                            setComentarios((prev) => ({ ...prev, [item.idGestion]: e.target.value }))
                          }
                        />
                        <div className="auc-input-footer">
                          <span className="auc-char-count">{(comentarios[item.idGestion] ?? "").length}/300</span>
                          <button
                            className="btn-compromiso"
                            disabled={guardandoId === item.idGestion}
                            onClick={() => enviarCompromiso(item)}
                          >
                            {guardandoId === item.idGestion ? (
                              <>
                                <i className="ph ph-circle-notch" style={{ animation: "spin 0.7s linear infinite" }} /> Guardando...
                              </>
                            ) : (
                              <>
                                <i className="ph ph-seal-check" /> Confirmar compromiso
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
      </div>
      <Toast message={toast} />
    </div>
  );
}
