"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import type { Modulo, ModuloId } from "@/lib/modulos";
import { MODULO_VISUALS } from "@/components/module-icons";
import { useModuleSound } from "@/lib/use-module-sound";
import "./home-view.css";

export interface TareaPendiente {
  id: string;
  titulo: string;
  moduloId: ModuloId;
  moduloNombre: string;
  moduloHref: string;
  fecha: string;
  prioridad: "Alta" | "Media" | "Baja";
}

export interface HomeData {
  progresoPct: number;
  progresoLabel: string;
  resumen: {
    compromisos: number;
    firmados: number;
    pendientes: number;
    vencidos: number;
    /** % vs. mes anterior, real; null si no hay dato del mes anterior para comparar */
    tendenciaPct: number | null;
  } | null;
}

const MODULO_TONE: Record<ModuloId, string> = {
  metricas: "lime",
  "pqrsf-data": "violet",
  "linea-amiga": "teal",
  radicaciones: "orange",
  quiz: "pink",
};

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const initial = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);
  return now;
}

function useCalendario() {
  const [hoy, setHoy] = useState<Date | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setHoy(new Date()), 0);
    return () => clearTimeout(id);
  }, []);

  if (!hoy) return { mesLabel: "", semanas: [] as (number | null)[][], diaActual: -1 };

  const mesLabelRaw = hoy.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1);

  const primerDiaSemana = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getDay();
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  return { mesLabel, semanas, diaActual: hoy.getDate() };
}

function UserMenu({ nombre, logoutAction }: { nombre: string; logoutAction: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inicial = (nombre.trim().charAt(0) || "?").toUpperCase();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="profile" ref={ref} style={{ position: "relative", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
      <div className="avatar">{inicial}</div>
      <div>
        <b>{nombre}</b>
      </div>
      <ChevronDown size={16} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            zIndex: 30,
            width: 200,
            overflow: "hidden",
            borderRadius: 14,
            border: "1px solid #e9eaf1",
            background: "#fff",
            boxShadow: "0 10px 30px rgba(35,28,74,.12)",
          }}
        >
          <div style={{ borderBottom: "1px solid #e9eaf1", padding: "12px 16px" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#171331" }}>{nombre}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#e11d48" }}
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function HomeView({
  nombre,
  modulos,
  logoutAction,
  tareas,
  data,
}: {
  nombre: string;
  modulos: Modulo[];
  logoutAction: () => void;
  tareas: TareaPendiente[];
  data: HomeData | null;
}) {
  const now = useNow();
  const primerNombre = nombre.split(" ")[0] || nombre;
  const { playClick } = useModuleSound();
  const alertas = tareas.filter((t) => t.prioridad === "Alta").length;
  const { mesLabel, semanas, diaActual } = useCalendario();

  const fechaLarga = now
    ? (() => {
        const raw = now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      })()
    : "";

  const progresoPct = data?.progresoPct ?? 0;
  const progresoMensaje =
    progresoPct >= 80 ? "¡Estás haciendo un gran trabajo! 💚" : progresoPct >= 50 ? "Vas por buen camino, sigue así." : "Aún tienes pendientes por resolver.";

  return (
    <div className="dusite-home">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">Du</div>
          <div>
            <b>Du Site</b>
            <span>Portal de Gestión</span>
          </div>
        </div>
        <nav>
          <button type="button" className="active">
            Inicio
          </button>
          <button
            type="button"
            onClick={() => {
              playClick();
              document.getElementById("pendientes")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Mi jornada
          </button>
          <button
            type="button"
            onClick={() => {
              playClick();
              document.getElementById("calendario")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Calendario
          </button>
        </nav>
        <div style={{ display: "flex", alignItems: "center", justifySelf: "end", gap: 12 }}>
          <Link href="#pendientes" onClick={playClick} className="bell" title="Tareas de prioridad alta">
            <Bell size={20} />
            {alertas > 0 && <i>{alertas}</i>}
          </Link>
          <UserMenu nombre={nombre} logoutAction={logoutAction} />
        </div>
      </header>

      <div className="shell">
        <section className="left">
          <div className="intro">
            <div className="welcome">
              <span className="date">{fechaLarga}</span>
              <h1>
                Hola, {primerNombre} <span aria-hidden="true">👋</span>
                <br />
                ¿Qué deseas
                <br />
                hacer <em>hoy?</em>
              </h1>
              <p>
                Tu espacio de trabajo, todo lo que
                <br />
                necesitas en un solo lugar.
              </p>
            </div>

            <article className="focus">
              <div className="focusCopy">
                <label>
                  <i />
                  ENFOQUE DEL DÍA
                </label>
                <h2>
                  Concentra tu energía
                  <br />
                  en lo importante
                </h2>
                <p>
                  {tareas.length > 0
                    ? `Tienes ${tareas.length} pendiente${tareas.length === 1 ? "" : "s"} por resolver esta semana.`
                    : "Estás al día con todos tus módulos."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    document.getElementById("pendientes")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Ver mi jornada <ArrowRight size={17} />
                </button>
              </div>
              <Image src="/du-site-focus.webp" alt="Espacio de trabajo Du Site" width={640} height={510} priority />
            </article>
          </div>

          <div className="middleRow">
            <article className="progressCard">
              <div className="ring" style={{ background: `conic-gradient(var(--lime) 0 ${progresoPct}%, #e9eaf1 ${progresoPct}%)` }}>
                <strong>{progresoPct}%</strong>
              </div>
              <div>
                <span>Tu progreso semanal</span>
                <b>
                  {data?.progresoLabel ?? "—"} <i />
                </b>
                <div className="progress">
                  <i style={{ width: `${progresoPct}%` }} />
                </div>
                <small>{progresoMensaje}</small>
              </div>
            </article>

            {data?.resumen && (
              <article className="summary">
                <div className="summaryHead">
                  <b>Resumen de compromisos</b>
                  <button type="button">Este mes⌄</button>
                </div>
                <div className="stats">
                  <Stat
                    Icon={Clock3}
                    tone="violet"
                    n={String(data.resumen.compromisos)}
                    title="Total compromisos"
                    sub={data.resumen.tendenciaPct !== null ? `${data.resumen.tendenciaPct >= 0 ? "↑" : "↓"} ${Math.abs(data.resumen.tendenciaPct)}% vs mes anterior` : "Este mes"}
                  />
                  <Stat
                    Icon={CheckCircle2}
                    tone="lime"
                    n={String(data.resumen.firmados)}
                    title="Firmados"
                    sub={data.resumen.compromisos > 0 ? `${Math.round((data.resumen.firmados / data.resumen.compromisos) * 100)}% del total` : "Sin datos"}
                  />
                  <Stat
                    Icon={Clock3}
                    tone="orange"
                    n={String(data.resumen.pendientes)}
                    title="Pendientes"
                    sub={data.resumen.compromisos > 0 ? `${Math.round((data.resumen.pendientes / data.resumen.compromisos) * 100)}% del total` : "Sin datos"}
                  />
                  <Stat
                    Icon={ClipboardCheck}
                    tone="violet"
                    n={String(data.resumen.vencidos)}
                    title="Vencidos (+5 días)"
                    sub={data.resumen.compromisos > 0 ? `${Math.round((data.resumen.vencidos / data.resumen.compromisos) * 100)}% del total` : "Sin datos"}
                  />
                </div>
              </article>
            )}
          </div>

          <div className="sectionTitle">
            <span>Tus módulos</span>
            <button type="button">
              <SlidersHorizontal size={15} /> Personalizar
            </button>
          </div>
          <section className="modules">
            {modulos.map((modulo) => {
              const visual = MODULO_VISUALS[modulo.id];
              const Icon = visual.icon;
              const tone = MODULO_TONE[modulo.id];
              return (
                <Link key={modulo.id} href={modulo.href} onClick={playClick} className={`module ${tone}`}>
                  <div className={`moduleIcon ${tone}`}>
                    <Icon size={28} />
                  </div>
                  <h3>{modulo.nombre}</h3>
                  <p>{modulo.descripcion}</p>
                  <span className="moduleGo">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </section>
        </section>

        <aside>
          <article className="calendar" id="calendario">
            <div className="calHead">
              <h3>{mesLabel}</h3>
              <div>
                <ChevronLeft size={17} />
                <ChevronRight size={17} />
              </div>
            </div>
            <div className="dow">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <b key={i}>{d}</b>
              ))}
            </div>
            {semanas.map((semana, i) => (
              <div className="week" key={i}>
                {semana.map((d, j) => (
                  <span key={j} className={d === diaActual ? "today" : ""}>
                    {d ?? ""}
                  </span>
                ))}
              </div>
            ))}
          </article>

          <article className="pending" id="pendientes">
            <div className="pendingHead">
              <h3>
                Pendientes <b>{tareas.length}</b>
              </h3>
            </div>
            {tareas.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#171331" }}>Sin pendientes por ahora</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#66708a" }}>Estás al día.</p>
              </div>
            ) : (
              tareas.map((t) => {
                const visual = MODULO_VISUALS[t.moduloId];
                const Icon = visual.icon;
                const tone = MODULO_TONE[t.moduloId];
                return (
                  <Link key={t.id} href={t.moduloHref} onClick={playClick} className="task">
                    <div className={`taskIcon ${tone}`}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <b>{t.titulo}</b>
                      <span>
                        {t.moduloNombre}
                        {t.fecha ? ` · ${t.fecha}` : ""}
                      </span>
                    </div>
                    <ChevronRight size={17} />
                  </Link>
                );
              })
            )}
            <div className="encourage">
              <b>⚡</b>
              <div>
                <strong>{progresoPct >= 80 ? "¡Vas muy bien!" : "¡Sigue así!"}</strong>
                <span>Mantén tu ritmo esta semana.</span>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}

function Stat({ Icon, tone, n, title, sub }: { Icon: typeof Clock3; tone: string; n: string; title: string; sub: string }) {
  return (
    <div className="stat">
      <div className={`statIcon ${tone}`}>
        <Icon size={22} />
      </div>
      <div>
        <strong>{n}</strong>
        <span>{title}</span>
        <small>{sub}</small>
      </div>
    </div>
  );
}
