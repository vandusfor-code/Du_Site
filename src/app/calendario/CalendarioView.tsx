"use client";

import "./calendario.css";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Settings,
  Plus,
  Users,
} from "lucide-react";
import { UserMenu } from "@/components/home-view";

export interface CalendarioEvento {
  id: string;
  anio: number;
  mes: number; // 0-based
  dia: number;
  horario: string;
  actividad: string;
  companero: string;
  link: string;
}

interface Categoria {
  id: string;
  label: string;
  dot: string;
  bg: string;
  color: string;
}

// Categorías visibles (identidad Du Site). Los eventos reales del Cronograma se
// mapean a estas por palabras clave; el color del dot es el del mockup y el de
// la tarjeta usa un fondo claro legible.
const CATEGORIAS: Categoria[] = [
  { id: "reuniones", label: "Reuniones", dot: "#8b5cf6", bg: "#e0f7f4", color: "#078d82" },
  { id: "capacitaciones", label: "Capacitaciones", dot: "#2f80ed", bg: "#fff0e3", color: "#9a4a16" },
  { id: "roleplays", label: "Role Plays", dot: "#ff8a34", bg: "#eee8ff", color: "#5332cc" },
  { id: "talleres", label: "Talleres", dot: "#22c7b8", bg: "#eae7ff", color: "#5332cc" },
  { id: "compromisos", label: "Compromisos", dot: "#f45b8b", bg: "#ffe6ef", color: "#c02f63" },
];
const CAT_MAP = new Map(CATEGORIAS.map((c) => [c.id, c]));

function categoriaDe(actividad: string): string {
  const a = actividad.toLowerCase();
  if (/role\s*play/.test(a)) return "roleplays";
  if (/escucha/.test(a)) return "capacitaciones";
  if (/reuni/.test(a)) return "reuniones";
  if (/taller/.test(a)) return "talleres";
  if (/capacit/.test(a)) return "capacitaciones";
  if (/compromiso/.test(a)) return "compromisos";
  return "roleplays";
}

const HORAS = ["6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM"];
const INICIO_MIN = 6 * 60; // 6 AM
const RANGO_MIN = 16 * 60; // 6 AM → 10 PM (16 filas)
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_SEM = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MINI_SEM = ["D", "L", "M", "M", "J", "V", "S"];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function inicioSemana(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - r.getDay()); // domingo
  return r;
}
function addDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Extrae inicio/fin (en minutos desde medianoche) de un texto de horario como
// "8:00 – 9:00 AM", "2:00 – 3:30 PM", "8:00 a. m. - 9:00 a. m." o "8:00 AM".
function parseHorario(horario: string): { inicio: number; fin: number } | null {
  const re = /(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/gi;
  const tokens: { h: number; m: number; mer: "am" | "pm" | null }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(horario)) !== null) {
    const mer = match[3] ? (/p/i.test(match[3]) ? "pm" : "am") : null;
    tokens.push({ h: parseInt(match[1], 10), m: parseInt(match[2], 10), mer });
  }
  if (tokens.length === 0) return null;

  const aMin = (t: { h: number; m: number; mer: "am" | "pm" | null }, fallback: "am" | "pm" | null): number => {
    let h = t.h;
    const mer = t.mer ?? fallback;
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    return h * 60 + t.m;
  };

  const merFin = tokens[tokens.length - 1].mer;
  const inicio = aMin(tokens[0], tokens[0].mer ?? merFin);
  let fin = tokens.length > 1 ? aMin(tokens[1], tokens[1].mer ?? merFin) : inicio + 60;
  if (fin <= inicio) fin = inicio + 60;
  return { inicio, fin };
}

export default function CalendarioView({
  nombre,
  eventos,
  logoutAction,
}: {
  nombre: string;
  eventos: CalendarioEvento[];
  logoutAction: () => void;
}) {
  const [semana, setSemana] = useState<Date>(() => inicioSemana(new Date()));
  const [miniMes, setMiniMes] = useState<Date>(() => new Date());
  const [filtros, setFiltros] = useState<Record<string, boolean>>(() => CATEGORIAS.reduce((a, c) => ({ ...a, [c.id]: true }), {}));
  const [ahora, setAhora] = useState<Date>(() => new Date());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDias(semana, i)), [semana]);

  // Eventos de la semana visible, posicionados en la grilla y filtrados por categoría.
  const eventosSemana = useMemo(() => {
    return eventos
      .map((e) => {
        const fecha = new Date(e.anio, e.mes, e.dia);
        const dayIndex = dias.findIndex((d) => mismoDia(d, fecha));
        if (dayIndex < 0) return null;
        const cat = categoriaDe(e.actividad);
        if (filtros[cat] === false) return null;
        const rango = parseHorario(e.horario);
        const inicio = rango?.inicio ?? INICIO_MIN;
        const fin = rango?.fin ?? inicio + 60;
        const top = Math.max(0, ((inicio - INICIO_MIN) / RANGO_MIN) * 100);
        const height = Math.max(6.5, ((fin - inicio) / RANGO_MIN) * 100);
        const c = CAT_MAP.get(cat)!;
        return { ...e, dayIndex, top, height, bg: c.bg, color: c.color };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }, [eventos, dias, filtros]);

  const hoy = new Date();
  const finSemana = addDias(semana, 6);
  const rangoLabel =
    semana.getMonth() === finSemana.getMonth()
      ? `${cap(MESES[semana.getMonth()])} de ${finSemana.getFullYear()}`
      : `${cap(MESES[semana.getMonth()])} – ${MESES[finSemana.getMonth()]} de ${finSemana.getFullYear()}`;

  // Mini calendario: semanas del mes visible (rejilla 6×7 desde el domingo).
  const miniInicio = inicioSemana(new Date(miniMes.getFullYear(), miniMes.getMonth(), 1));
  const miniCeldas = Array.from({ length: 42 }, (_, i) => addDias(miniInicio, i));

  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const hoyEnSemana = dias.findIndex((d) => mismoDia(d, ahora));
  const mostrarNow = hoyEnSemana >= 0 && ahoraMin >= INICIO_MIN && ahoraMin <= INICIO_MIN + RANGO_MIN;
  const nowTop = ((ahoraMin - INICIO_MIN) / RANGO_MIN) * 100;

  function irSemanaDe(d: Date) {
    setSemana(inicioSemana(d));
    setMiniMes(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function nuevoEvento() {
    setToast("Próximamente podrás crear eventos desde aquí.");
    setTimeout(() => setToast(null), 3200);
  }

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
          <Link href="/"><button type="button">Inicio</button></Link>
          <Link href="/#pendientes"><button type="button">Mi jornada</button></Link>
          <button type="button" className="active">Calendario</button>
        </nav>
        <div style={{ display: "flex", alignItems: "center", justifySelf: "end", gap: 12 }}>
          <Link href="/#pendientes" className="bell" title="Notificaciones">
            <Bell size={20} />
          </Link>
          <UserMenu nombre={nombre} logoutAction={logoutAction} />
        </div>
      </header>

      <div className="dusite-cal">
        <div className="cal-titleRow">
          <div>
            <h1>Calendario</h1>
            <p>Consulta tu agenda y gestiona tus eventos y actividades.</p>
          </div>
          <button className="cal-primary" type="button" onClick={nuevoEvento}>
            <Plus size={18} /> Nuevo evento
          </button>
        </div>

        <div className="cal-workspace">
          {/* Panel lateral: mini calendario, calendarios y filtros */}
          <aside className="cal-side">
            <div className="cal-mini">
              <div className="cal-miniHead">
                <strong>{cap(MESES[miniMes.getMonth()])} de {miniMes.getFullYear()}</strong>
                <span>
                  <button type="button" onClick={() => setMiniMes(new Date(miniMes.getFullYear(), miniMes.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                  <button type="button" onClick={() => setMiniMes(new Date(miniMes.getFullYear(), miniMes.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                </span>
              </div>
              <div className="cal-miniLabels">{MINI_SEM.map((x, i) => <b key={i}>{x}</b>)}</div>
              <div className="cal-miniGrid">
                {miniCeldas.map((d, i) => {
                  const otroMes = d.getMonth() !== miniMes.getMonth();
                  const esHoy = mismoDia(d, hoy);
                  const enSemana = d >= semana && d <= finSemana;
                  const cls = ["cal-miniDay"];
                  if (otroMes) cls.push("otro");
                  if (esHoy) cls.push("hoy");
                  else if (enSemana) cls.push("sem");
                  return (
                    <button type="button" key={i} className={cls.join(" ")} onClick={() => irSemanaDe(d)}>
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="cal-sideSection">
              <div className="cal-sectionTitle"><strong>Mis calendarios</strong><Plus size={17} /></div>
              <label className="cal-check">
                <input type="checkbox" defaultChecked />
                <span><b>{nombre || "Mi agenda"}</b><small>Mi agenda</small></span>
              </label>
              <label className="cal-check"><input type="checkbox" /><span><b>Cumpleaños</b></span></label>
              <label className="cal-check"><input type="checkbox" /><span><b>Tareas y recordatorios</b></span></label>
              <button className="cal-more" type="button">Mostrar más <ChevronDown size={14} /></button>
            </div>

            <div className="cal-sideSection">
              <div className="cal-sectionTitle"><strong>Filtros rápidos</strong><Plus size={17} /></div>
              {CATEGORIAS.map((c) => (
                <label className="cal-filter" key={c.id}>
                  <input type="checkbox" checked={filtros[c.id]} onChange={() => setFiltros((v) => ({ ...v, [c.id]: !v[c.id] }))} />
                  <span className="cal-dot" style={{ background: c.dot }} />
                  {c.label}
                </label>
              ))}
            </div>
          </aside>

          {/* Panel principal: agenda semanal */}
          <section className="cal-card">
            <div className="cal-toolbar">
              <div className="cal-toolbarLeft">
                <button className="cal-outline" type="button" onClick={() => irSemanaDe(new Date())}>Hoy</button>
                <button className="cal-iconBtn" type="button" onClick={() => setSemana(addDias(semana, -7))}><ChevronLeft /></button>
                <button className="cal-iconBtn" type="button" onClick={() => setSemana(addDias(semana, 7))}><ChevronRight /></button>
                <strong>{rangoLabel}</strong>
                <ChevronDown size={16} />
              </div>
              <div className="cal-toolbarRight">
                <button className="cal-outline" type="button">Semana <ChevronDown size={15} /></button>
                <button className="cal-iconBox cal-selectedTool" type="button"><CalendarDays /></button>
                <button className="cal-iconBox" type="button"><List /></button>
                <button className="cal-iconBox" type="button"><Settings /></button>
              </div>
            </div>

            <div className="cal-gridWrap">
              <div className="cal-dayHeader">
                <div className="cal-tz">GMT-5</div>
                {dias.map((d, i) => (
                  <div className="cal-dayCell" key={i}>
                    <small>{DIAS_SEM[d.getDay()]}</small>
                    <span className={mismoDia(d, hoy) ? "cal-today" : ""}>{d.getDate()}</span>
                  </div>
                ))}
              </div>
              <div className="cal-grid">
                <div className="cal-times">{HORAS.map((h) => <div key={h}>{h}</div>)}</div>
                {dias.map((d, di) => (
                  <div className="cal-dayColumn" key={di}>
                    {HORAS.map((h) => <div className="cal-hourLine" key={h} />)}
                    {eventosSemana.filter((e) => e.dayIndex === di).map((e) => (
                      <div
                        key={e.id}
                        className="cal-event"
                        style={{ top: `${e.top}%`, height: `${e.height}%`, background: e.bg, color: e.color }}
                        title={`${e.actividad}${e.companero ? ` · con ${e.companero}` : ""} · ${e.horario}`}
                      >
                        <b>• {e.actividad}</b>
                        <span>{e.horario}</span>
                        {e.companero && (
                          <small><Users size={12} /> {e.companero}</small>
                        )}
                      </div>
                    ))}
                    {di === hoyEnSemana && mostrarNow && (
                      <div className="cal-nowLine" style={{ top: `${nowTop}%` }}><span /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {toast && <div className="cal-toast">{toast}</div>}
    </div>
  );
}
