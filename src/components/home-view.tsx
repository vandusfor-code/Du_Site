"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FolderOpen,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Modulo, ModuloId } from "@/lib/modulos";
import type { GestionesMes } from "@/lib/lineaAmiga";
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
  /** Etiqueta de acción opcional (ej. "Comenzar" / "Continuar") mostrada como pill. */
  accion?: string;
  /** Momento real en que la tarea fue creada/asignada/notificada (epoch ms). ES el criterio de orden (más reciente primero). No se muestra. */
  createdAtTs?: number;
  /** Fecha límite / vencimiento / sesión (epoch ms). Solo informativo — NO participa en el orden. */
  dueAtTs?: number;
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
  gestionesMes: GestionesMes | null;
  /** Días con sesiones de Cronograma (Role Play / Escuchas) asignadas, de cualquier mes. */
  calendario: { anio: number; mes: number; dia: number; detalle: string }[];
}

const MODULO_TONE: Record<ModuloId, string> = {
  metricas: "lime",
  "pqrsf-data": "violet",
  "linea-amiga": "teal",
  radicaciones: "orange",
  quiz: "pink",
  admin: "violet",
  desempeno: "violet",
  documentacion: "violet",
};

const PENDIENTES_VISIBLES = 5;

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

function useCalendario(offsetMeses: number) {
  const [hoy, setHoy] = useState<Date | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setHoy(new Date()), 0);
    return () => clearTimeout(id);
  }, []);

  if (!hoy) {
    return { mesLabel: "", semanas: [] as (number | null)[][], diaActual: -1, anioVisible: -1, mesVisible: -1 };
  }

  const visible = new Date(hoy.getFullYear(), hoy.getMonth() + offsetMeses, 1);
  const anioVisible = visible.getFullYear();
  const mesVisible = visible.getMonth();
  const esMesActual = anioVisible === hoy.getFullYear() && mesVisible === hoy.getMonth();

  const mesLabelRaw = visible.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1);

  const primerDiaSemana = new Date(anioVisible, mesVisible, 1).getDay();
  const diasEnMes = new Date(anioVisible, mesVisible + 1, 0).getDate();

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  return { mesLabel, semanas, diaActual: esMesActual ? hoy.getDate() : -1, anioVisible, mesVisible };
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
          onClick={(e) => e.stopPropagation()}
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

const MAX_MODULOS_HOME = 5;

function claveModulos(usuario: string): string {
  return `dusite:home-modulos:${usuario || "anon"}`;
}

// Intersecta la preferencia local (orden guardado) con los módulos realmente
// permitidos: nunca muestra un módulo no autorizado y añade al final los nuevos
// permitidos que aún no estén en la preferencia. Sin preferencia → primeros N.
function resolverVisibles(modulos: Modulo[], pref: string[] | null): Modulo[] {
  const permitidos = new Map(modulos.map((m) => [m.id, m]));
  if (!pref || pref.length === 0) return modulos.slice(0, MAX_MODULOS_HOME);
  const ordenados: Modulo[] = [];
  for (const id of pref) {
    const m = permitidos.get(id as ModuloId);
    if (m && !ordenados.includes(m)) ordenados.push(m);
  }
  for (const m of modulos) if (!ordenados.includes(m)) ordenados.push(m);
  return ordenados.slice(0, MAX_MODULOS_HOME);
}

export function HomeView({
  nombre,
  usuario,
  modulos,
  logoutAction,
  tareas,
  data,
}: {
  nombre: string;
  usuario: string;
  modulos: Modulo[];
  logoutAction: () => void;
  tareas: TareaPendiente[];
  data: HomeData | null;
}) {
  const now = useNow();
  const primerNombre = nombre.split(" ")[0] || nombre;
  const { playClick } = useModuleSound();
  const [mostrarTodasTareas, setMostrarTodasTareas] = useState(false);
  const [prefModulos, setPrefModulos] = useState<string[] | null>(null);
  const [personalizarAbierto, setPersonalizarAbierto] = useState(false);

  useEffect(() => {
    // Se difiere con setTimeout(0) para no llamar setState en el cuerpo síncrono
    // del effect (regla react-hooks/set-state-in-effect) y evitar mismatch de hidratación.
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(claveModulos(usuario));
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setPrefModulos(arr.filter((x) => typeof x === "string"));
        }
      } catch {
        /* localStorage no disponible: se usa el orden por defecto */
      }
    }, 0);
    return () => clearTimeout(id);
  }, [usuario]);

  const modulosVisibles = resolverVisibles(modulos, prefModulos);

  function guardarPreferencia(ids: string[]) {
    setPrefModulos(ids);
    try {
      localStorage.setItem(claveModulos(usuario), JSON.stringify(ids));
    } catch {
      /* si falla el guardado, la preferencia queda solo en memoria de la sesión */
    }
    setPersonalizarAbierto(false);
  }
  const alertas = tareas.filter((t) => t.prioridad === "Alta").length;
  const [offsetMeses, setOffsetMeses] = useState(0);
  const [resaltarCalendario, setResaltarCalendario] = useState(false);
  const { mesLabel, semanas, diaActual, anioVisible, mesVisible } = useCalendario(offsetMeses);

  const fechaLarga = now
    ? (() => {
        const raw = now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      })()
    : "";

  const progresoPct = data?.progresoPct ?? 0;
  const progresoMensaje =
    progresoPct >= 80 ? "¡Estás haciendo un gran trabajo! 💚" : progresoPct >= 50 ? "Vas por buen camino, sigue así." : "Aún tienes pendientes por resolver.";

  const diasMarcadosMap = new Map(
    (data?.calendario ?? [])
      .filter((c) => c.anio === anioVisible && c.mes === mesVisible)
      .map((c) => [c.dia, c.detalle])
  );

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
              document.getElementById("calendario")?.scrollIntoView({ behavior: "smooth", block: "center" });
              setResaltarCalendario(true);
              setTimeout(() => setResaltarCalendario(false), 1200);
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
              <span>Tu progreso semanal</span>
              <b>
                {progresoPct}% · {data?.progresoLabel ?? "—"} <i />
              </b>
              <div className="progress">
                <i style={{ width: `${progresoPct}%` }} />
              </div>
              <small>{progresoMensaje}</small>
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
            <div className="sectionActions">
              <Link href="/modulos" className="sectionLink" onClick={playClick}>
                <LayoutGrid size={15} /> Ver todos
              </Link>
              <button type="button" onClick={() => setPersonalizarAbierto(true)}>
                <SlidersHorizontal size={15} /> Personalizar
              </button>
            </div>
          </div>
          <section className="modules">
            {modulosVisibles.map((modulo) => {
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
          <article className={`calendar${resaltarCalendario ? " resaltado" : ""}`} id="calendario">
            <div className="calHead">
              <h3>{mesLabel}</h3>
              <div>
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => {
                    playClick();
                    setOffsetMeses((v) => v - 1);
                  }}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => {
                    playClick();
                    setOffsetMeses((v) => v + 1);
                  }}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
            <div className="dow">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <b key={i}>{d}</b>
              ))}
            </div>
            {semanas.map((semana, i) => (
              <div className="week" key={i}>
                {semana.map((d, j) => {
                  const marcado = d ? diasMarcadosMap.get(d) : undefined;
                  const clases = [d === diaActual ? "today" : "", marcado ? "hasEvent" : ""].filter(Boolean).join(" ");
                  return (
                    <span key={j} className={clases || undefined} title={marcado}>
                      {d ?? ""}
                    </span>
                  );
                })}
              </div>
            ))}
          </article>

          <article className="pending" id="pendientes">
            <div className="pendingHead">
              <h3>
                Pendientes <b>{tareas.length}</b>
              </h3>
              {tareas.length > PENDIENTES_VISIBLES && (
                <button type="button" onClick={() => setMostrarTodasTareas((v) => !v)}>
                  {mostrarTodasTareas ? "Ver menos" : "Ver todos"}
                </button>
              )}
            </div>
            {tareas.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#171331" }}>Sin pendientes por ahora</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#66708a" }}>Estás al día.</p>
              </div>
            ) : (
              (mostrarTodasTareas ? tareas : tareas.slice(0, PENDIENTES_VISIBLES)).map((t) => {
                const visual = MODULO_VISUALS[t.moduloId];
                const Icon = visual.icon;
                const tone = MODULO_TONE[t.moduloId];
                return (
                  <Link key={t.id} href={t.moduloHref} onClick={playClick} className="task">
                    <div className={`taskIcon ${tone}`}>
                      <Icon size={22} />
                    </div>
                    <div className="taskBody">
                      <b>{t.titulo}</b>
                      <span className="taskMeta">
                        <span className="taskMetaText">
                          {t.moduloNombre}
                          {t.fecha ? ` · ${t.fecha}` : ""}
                        </span>
                        {t.accion ? <span className="taskAction">{t.accion}</span> : null}
                      </span>
                    </div>
                    <ChevronRight size={17} className="taskArrow" />
                  </Link>
                );
              })
            )}
          </article>
        </aside>
      </div>

      {data?.gestionesMes && (
        <div className="gestionesStripWrap">
          <article className="gestionesStrip">
            <div className="gestionesStripLabel">
              <div className="statIcon violet">
                <BarChart3 size={20} />
              </div>
              <b>Gestiones del mes</b>
            </div>
            <MiniStat Icon={Clock3} tone="violet" n={data.gestionesMes.pqrsfHoy} label="PQRSF hoy" />
            <MiniStat Icon={CheckCircle2} tone="lime" n={data.gestionesMes.pqrsfMes} label="PQRSF mes" />
            <MiniStat Icon={FolderOpen} tone="orange" n={data.gestionesMes.radicadosHoy} label="Radicados hoy" />
            <MiniStat Icon={ClipboardCheck} tone="teal" n={data.gestionesMes.radicadosMes} label="Radicados mes" />
            <MiniStat Icon={BarChart3} tone="violet" n={data.gestionesMes.gestionesTotalesMes} label="Gestiones totales mes" />
            <MiniStat Icon={MessageSquareText} tone="pink" n={data.gestionesMes.pqrsfPorComunicar} label="PQRSF por comunicar" />
            <MiniStat Icon={CheckCircle2} tone="teal" n={data.gestionesMes.pqrsfComunicados} label="PQRSF comunicados" />
          </article>
        </div>
      )}

      {personalizarAbierto && (
        <PersonalizarModulos
          modulos={modulos}
          seleccionInicial={modulosVisibles.map((m) => m.id)}
          onGuardar={guardarPreferencia}
          onCerrar={() => setPersonalizarAbierto(false)}
        />
      )}
    </div>
  );
}

function PersonalizarModulos({
  modulos,
  seleccionInicial,
  onGuardar,
  onCerrar,
}: {
  modulos: Modulo[];
  seleccionInicial: string[];
  onGuardar: (ids: string[]) => void;
  onCerrar: () => void;
}) {
  // `seleccion` mantiene el ORDEN elegido; los no seleccionados se muestran aparte.
  const [seleccion, setSeleccion] = useState<string[]>(seleccionInicial.slice(0, MAX_MODULOS_HOME));
  const porId = new Map(modulos.map((m) => [m.id, m]));
  const noSeleccionados = modulos.filter((m) => !seleccion.includes(m.id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_MODULOS_HOME) return prev; // tope de 5
      return [...prev, id];
    });
  }
  function mover(i: number, dir: -1 | 1) {
    setSeleccion((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  return (
    <div className="persoOverlay" onClick={onCerrar}>
      <div className="persoDrawer" onClick={(e) => e.stopPropagation()}>
        <div className="persoHead">
          <div>
            <h3>Personalizar módulos</h3>
            <p>Elige hasta {MAX_MODULOS_HOME} módulos para tu inicio y ordénalos. No cambia tus permisos.</p>
          </div>
          <button type="button" className="persoClose" onClick={onCerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="persoBody">
          <div className="persoGroupTitle">En tu inicio ({seleccion.length}/{MAX_MODULOS_HOME})</div>
          {seleccion.length === 0 && <div className="persoEmpty">Aún no has elegido módulos.</div>}
          {seleccion.map((id, i) => {
            const m = porId.get(id as ModuloId);
            if (!m) return null;
            const visual = MODULO_VISUALS[m.id];
            const Icon = visual.icon;
            return (
              <div className="persoItem" key={id}>
                <span className="persoIcon" style={{ background: visual.accentBg, color: visual.accentFg }}>
                  <Icon size={16} />
                </span>
                <span className="persoName">{m.nombre}</span>
                <button type="button" className="persoMove" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="persoMove" onClick={() => mover(i, 1)} disabled={i === seleccion.length - 1} aria-label="Bajar">
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="persoToggle persoActivo" onClick={() => alternar(id)} aria-label="Quitar">
                  <Check size={14} />
                </button>
              </div>
            );
          })}

          {noSeleccionados.length > 0 && (
            <>
              <div className="persoGroupTitle">Disponibles</div>
              {noSeleccionados.map((m) => {
                const visual = MODULO_VISUALS[m.id];
                const Icon = visual.icon;
                const lleno = seleccion.length >= MAX_MODULOS_HOME;
                return (
                  <div className="persoItem" key={m.id}>
                    <span className="persoIcon" style={{ background: visual.accentBg, color: visual.accentFg }}>
                      <Icon size={16} />
                    </span>
                    <span className="persoName">{m.nombre}</span>
                    <button
                      type="button"
                      className="persoToggle"
                      onClick={() => alternar(m.id)}
                      disabled={lleno}
                      title={lleno ? `Máximo ${MAX_MODULOS_HOME}` : "Agregar"}
                    >
                      Agregar
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="persoFoot">
          <button type="button" className="persoBtnGhost" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="persoBtnPrimary" onClick={() => onGuardar(seleccion)}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ Icon, tone, n, label }: { Icon: typeof Clock3; tone: string; n: number; label: string }) {
  return (
    <div className="gestionesStat">
      <div className={`statIcon ${tone}`}>
        <Icon size={18} />
      </div>
      <div>
        <strong>{n.toLocaleString("es-CO")}</strong>
        <span>{label}</span>
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
