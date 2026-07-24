"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, LogOut } from "lucide-react";
import type { Modulo, ModuloId } from "@/lib/modulos";

export interface TareaPendiente {
  id: string;
  titulo: string;
  moduloId: ModuloId;
  moduloNombre: string;
  moduloHref: string;
  fecha: string;
  prioridad: "Alta" | "Media" | "Baja";
}

export interface HorarioNormalizado {
  jornada?: string;
  almuerzo?: string;
  break1?: string;
  break2?: string;
}

export interface HomeData {
  progresoPct: number;
  progresoLabel: string;
  calidad: { label: string; valor: string } | null;
  turno: { horario: HorarioNormalizado | null; moduloOrigen: "linea-amiga" | "radicaciones" | null };
  pqrsf: { casosEnBase: number; consultasPorDia: number[] } | null;
  cardRadicaciones: { hoy: number; mes: number } | null;
  cardDuAcademy: { pct: number } | null;
  cardLineaAmiga: { hoy: number } | null;
  resumenSemanal: {
    compromisos: number;
    firmados: number;
    pendientes: number;
    vencidos: number;
    serie: number[];
    areas: { label: string; color: string; pct: number }[];
  } | null;
}

function saludoPorHora(h: number): string {
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

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

function useSaludo() {
  const [saludo, setSaludo] = useState("Bienvenida");
  useEffect(() => {
    const id = setTimeout(() => setSaludo(saludoPorHora(new Date().getHours())), 0);
    return () => clearTimeout(id);
  }, []);
  return saludo;
}

function parseHora(h?: string): Date | null {
  if (!h) return null;
  const clean = h.trim();
  if (!clean || clean === "-" || /descanso/i.test(clean)) return null;
  const m = clean.toLowerCase().match(/(\d+):(\d+)\s*(am|pm)/);
  if (!m) return null;
  let hrs = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === "pm" && hrs < 12) hrs += 12;
  if (m[3] === "am" && hrs === 12) hrs = 0;
  const d = new Date();
  d.setHours(hrs, min, 0, 0);
  return d;
}

function useTurnoCountdown(horario: HorarioNormalizado | null) {
  const now = useNow();

  if (!horario) return { countdown: "--:--", label: "Sin turno asignado hoy" };
  if (!now) return { countdown: "--:--", label: "Sincronizando turno..." };

  const [inicioTxt, finTxt] = (horario.jornada ?? "").split(" a ");
  const inicio = parseHora(inicioTxt);
  const fin = parseHora(finTxt);
  const [b1Txt] = (horario.break1 ?? "").split(" a ");
  const [b2Txt] = (horario.break2 ?? "").split(" a ");
  const [almTxt] = (horario.almuerzo ?? "").split(" a ");

  const eventos = [
    { t: parseHora(b1Txt), l: "tu break" },
    { t: parseHora(almTxt), l: "tu almuerzo" },
    { t: parseHora(b2Txt), l: "tu break" },
    { t: fin, l: "el fin de tu jornada" },
  ].filter((e): e is { t: Date; l: string } => !!e.t);

  eventos.sort((a, b) => a.t.getTime() - b.t.getTime());
  const proximo = eventos.find((e) => e.t > now);

  if (!inicio || !fin || now < inicio || now > fin) {
    return { countdown: "--:--", label: "Fuera de turno" };
  }
  if (!proximo) return { countdown: "--:--", label: "Sin más eventos hoy" };

  const diff = Math.max(0, proximo.t.getTime() - now.getTime());
  const mm = Math.floor(diff / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  return { countdown: `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, label: `hasta ${proximo.l}` };
}

function useCalendario() {
  const [hoy, setHoy] = useState<Date | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setHoy(new Date()), 0);
    return () => clearTimeout(id);
  }, []);

  if (!hoy) return { mesLabel: "", dias: [] as number[], diaActual: -1 };

  const mesLabelRaw = hoy.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1);
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const dias = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  return { mesLabel, dias, diaActual: hoy.getDate() };
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
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#2B234F] text-[11px] font-bold text-[#CCFF00]">
          {inicial}
        </span>
        <ChevronDown size={14} className={`hidden text-[#9AA0AC] transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-52 overflow-hidden rounded-[14px] border border-[rgba(23,19,33,0.06)] bg-white shadow-[0_12px_35px_rgba(30,35,60,0.12)]">
          <div className="border-b border-[rgba(23,19,33,0.06)] px-4 py-3">
            <p className="truncate text-[13px] font-bold text-[#1A1535]">{nombre}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] font-semibold text-[#e11d48] transition-colors hover:bg-[#fff1f2]">
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SoundIcon({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer" }} title={on ? "Silenciar sonido" : "Activar sonido"}>
      {on ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 010 7" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M23 9l-6 6M17 9l6 6" />
        </svg>
      )}
    </div>
  );
}

const PRIORIDAD_DOT: Record<TareaPendiente["prioridad"], string> = {
  Alta: "#DC2626",
  Media: "#B45309",
  Baja: "#5D8A00",
};

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
  const saludo = useSaludo();
  const primerNombre = nombre.split(" ")[0] || nombre;
  const [soundOn, setSoundOn] = useState(true);
  const alertas = tareas.filter((t) => t.prioridad === "Alta").length;

  const { countdown: turnoCountdown, label: turnoLabel } = useTurnoCountdown(data?.turno.horario ?? null);
  const { mesLabel, dias: calDias, diaActual } = useCalendario();

  const tieneModulo = (id: ModuloId) => modulos.some((m) => m.id === id);
  const hrefModulo = (id: ModuloId) => modulos.find((m) => m.id === id)?.href ?? "/";

  const progresoPct = data?.progresoPct ?? 0;
  const progresoAngulo = Math.round((progresoPct / 100) * 360);

  return (
    <div style={{ minHeight: "100vh", background: "#F5F4FA", fontFamily: "'Inter', sans-serif", color: "#171321" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", background: "#fff", borderBottom: "1px solid rgba(23,19,33,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#2B234F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#CCFF00", fontWeight: 800, fontSize: 12 }}>Du</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#2B234F" }}>Du Site</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F5F4FA", borderRadius: 12, padding: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#2B234F", padding: "8px 16px", borderRadius: 9 }}>Inicio</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8B90A0", padding: "8px 16px" }}>Calendario</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8B90A0", padding: "8px 16px" }}>Analítica</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SoundIcon on={soundOn} onClick={() => setSoundOn((v) => !v)} />
          <Link href="#pendientes" style={{ position: "relative", color: "#6B7280", cursor: "pointer", display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {alertas > 0 && (
              <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: "#CCFF00", border: "1.5px solid #fff" }} />
            )}
          </Link>
          <UserMenu nombre={nombre} logoutAction={logoutAction} />
        </div>
      </div>

      <div
        className="home-grid"
        style={{
          maxWidth: 1760,
          margin: "0 auto",
          padding: "28px clamp(24px,4vw,64px) 60px",
          display: "grid",
          gridTemplateColumns: "300px minmax(0,1.3fr) 320px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 24, boxShadow: "0 4px 20px rgba(43,35,79,0.05)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1535", marginBottom: 4 }}>Hola, {primerNombre}.</div>
            <div style={{ fontSize: 12, color: "#9AA0AC", fontWeight: 500, lineHeight: 1.5, marginBottom: 18 }}>
              {saludo}. {tareas.length > 0 ? `Tienes ${tareas.length} pendiente${tareas.length === 1 ? "" : "s"} por resolver esta semana.` : "Estás al día con tus módulos."}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: `conic-gradient(#CCFF00 0deg ${progresoAngulo}deg, #F0F1F6 ${progresoAngulo}deg 360deg)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#1A1535" }}>
                  {progresoPct}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA0AC" }}>Tu progreso</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1A1535" }}>{data?.progresoLabel ?? "—"}</div>
              </div>
            </div>
            <Link href="#pendientes" style={{ display: "block", background: "#2B234F", color: "#CCFF00", textAlign: "center", padding: 12, borderRadius: 13, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Ver agenda
            </Link>
          </div>

          <div style={{ position: "relative", width: "100%", height: 170, flexShrink: 0, borderRadius: 22, overflow: "hidden" }}>
            <Image src="/trabajo-en-equipo.webp" alt="Trabajo en equipo: juntos logramos más" fill style={{ objectFit: "cover" }} />
          </div>

          {data?.turno.horario && (
            <div style={{ background: "linear-gradient(155deg,#2B234F,#1A1535)", borderRadius: 22, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#CCFF00" }} />
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Tu turno</span>
              </div>
              <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums" }}>{turnoCountdown}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10.5, fontWeight: 600 }}>{turnoLabel}</div>
            </div>
          )}
        </div>

        {/* Middle column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {(tieneModulo("metricas") || tieneModulo("pqrsf-data")) && (
            <div style={{ display: "grid", gridTemplateColumns: tieneModulo("metricas") && tieneModulo("pqrsf-data") ? "2fr 1fr" : "1fr", gap: 14, minWidth: 0 }}>
              {tieneModulo("metricas") && (
                <Link href={hrefModulo("metricas")} style={{ background: "#fff", borderRadius: 18, padding: 18, minWidth: 0, boxShadow: "0 4px 16px rgba(43,35,79,0.05)", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9AA0AC", letterSpacing: 0.8, textTransform: "uppercase" }}>
                      {data?.calidad?.label ?? "Métricas"}
                    </span>
                    <span style={{ color: "#C4C9D6", fontSize: 13 }}>→</span>
                  </div>
                  {data?.calidad ? (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#1A1535", letterSpacing: -0.6, marginBottom: 2 }}>{data.calidad.valor}</div>
                      <div style={{ fontSize: 11, color: "#9AA0AC", fontWeight: 600, marginBottom: 12 }}>Indicador actual de tu área</div>
                      <div style={{ width: "100%", height: 6, background: "#F0F1F6", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: data.calidad.valor, background: "#7C6FCB", borderRadius: 99 }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9AA0AC", fontWeight: 600 }}>Ver mis indicadores →</div>
                  )}
                </Link>
              )}
              {tieneModulo("pqrsf-data") && (
                <Link href={hrefModulo("pqrsf-data")} style={{ background: "#fff", borderRadius: 18, padding: 18, cursor: "pointer", minWidth: 0, boxShadow: "0 4px 16px rgba(43,35,79,0.05)", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9AA0AC", letterSpacing: 0.8, textTransform: "uppercase" }}>PQRSF DATA</span>
                    <span style={{ color: "#C4C9D6", fontSize: 13 }}>→</span>
                  </div>
                  {data?.pqrsf ? (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#1A1535", letterSpacing: -0.6, marginBottom: 2 }}>
                        {data.pqrsf.casosEnBase.toLocaleString("es-CO")}
                      </div>
                      <div style={{ fontSize: 11, color: "#9AA0AC", fontWeight: 600, marginBottom: "auto" }}>Casos en base</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 10, height: 32 }}>
                        {data.pqrsf.consultasPorDia.map((v, i) => {
                          const max = Math.max(1, ...data.pqrsf!.consultasPorDia);
                          return <div key={i} style={{ flex: 1, background: "#0D9488", borderRadius: "3px 3px 1px 1px", height: `${Math.max(8, (v / max) * 100)}%` }} />;
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9AA0AC", fontWeight: 600, marginTop: "auto" }}>Buscar y clasificar casos →</div>
                  )}
                </Link>
              )}
            </div>
          )}

          {(tieneModulo("radicaciones") || tieneModulo("quiz") || tieneModulo("linea-amiga")) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${[tieneModulo("radicaciones"), tieneModulo("quiz"), tieneModulo("linea-amiga")].filter(Boolean).length}, 1fr)`,
                gap: 14,
                minWidth: 0,
              }}
            >
              {tieneModulo("radicaciones") && (
                <Link href={hrefModulo("radicaciones")} style={{ background: "#fff", borderRadius: 18, padding: 16, cursor: "pointer", minWidth: 0, boxShadow: "0 4px 16px rgba(43,35,79,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9AA0AC", letterSpacing: 0.8, textTransform: "uppercase" }}>Radicaciones</span>
                  </div>
                  {data?.cardRadicaciones ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#1A1535", letterSpacing: -0.4, marginBottom: 3 }}>{data.cardRadicaciones.hoy}</div>
                      <div style={{ fontSize: 10.5, color: "#9AA0AC", fontWeight: 600, marginBottom: 9 }}>Radicaciones registradas hoy</div>
                      <div style={{ width: "100%", height: 6, background: "#F0F1F6", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, data.cardRadicaciones.hoy * 10)}%`, background: "#EA580C", borderRadius: 99 }} />
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280" }}>{data.cardRadicaciones.mes} este mes</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9AA0AC", fontWeight: 600 }}>Ir al módulo →</div>
                  )}
                </Link>
              )}
              {tieneModulo("quiz") && (
                <Link href={hrefModulo("quiz")} style={{ background: "#fff", borderRadius: 18, padding: 16, cursor: "pointer", minWidth: 0, boxShadow: "0 4px 16px rgba(43,35,79,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9AA0AC", letterSpacing: 0.8, textTransform: "uppercase" }}>Du Academy</span>
                  </div>
                  {data?.cardDuAcademy ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#1A1535", letterSpacing: -0.4, marginBottom: 3 }}>{data.cardDuAcademy.pct}%</div>
                      <div style={{ width: "100%", height: 6, background: "#F0F1F6", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${data.cardDuAcademy.pct}%`, background: "#DB2777", borderRadius: 99 }} />
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280" }}>Progreso general</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9AA0AC", fontWeight: 600 }}>Ir al módulo →</div>
                  )}
                </Link>
              )}
              {tieneModulo("linea-amiga") && (
                <Link href={hrefModulo("linea-amiga")} style={{ background: "#fff", borderRadius: 18, padding: 16, cursor: "pointer", minWidth: 0, boxShadow: "0 4px 16px rgba(43,35,79,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9AA0AC", letterSpacing: 0.8, textTransform: "uppercase" }}>Línea Amiga</span>
                  </div>
                  {data?.cardLineaAmiga ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#1A1535", letterSpacing: -0.4, marginBottom: 3 }}>{data.cardLineaAmiga.hoy}</div>
                      <div style={{ fontSize: 10.5, color: "#9AA0AC", fontWeight: 600, marginBottom: 9 }}>PQRSF registrados hoy</div>
                      <div style={{ width: "100%", height: 6, background: "#F0F1F6", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, data.cardLineaAmiga.hoy * 10)}%`, background: "#2563EB", borderRadius: 99 }} />
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280" }}>{turnoLabel}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9AA0AC", fontWeight: 600 }}>Ir al módulo →</div>
                  )}
                </Link>
              )}
            </div>
          )}

          {data?.resumenSemanal && (
            <div style={{ background: "#fff", borderRadius: 22, padding: "18px 20px", boxShadow: "0 4px 20px rgba(43,35,79,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1A1535" }}>Resumen de compromisos</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", background: "#F4F5F9", padding: "4px 10px", borderRadius: 8 }}>Este mes</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  { label: "Compromisos", value: data.resumenSemanal.compromisos, color: "#2563EB" },
                  { label: "Firmados", value: data.resumenSemanal.firmados, color: "#0D9488" },
                  { label: "Pendientes", value: data.resumenSemanal.pendientes, color: "#B45309" },
                  { label: "Vencidos (+5 días)", value: data.resumenSemanal.vencidos, color: "#DB2777" },
                ].map((w) => (
                  <div key={w.label} style={{ flex: 1, minWidth: 90 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#1A1535", whiteSpace: "nowrap" }}>{w.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9AA0AC", whiteSpace: "nowrap" }}>{w.label}</div>
                  </div>
                ))}
              </div>
              {data.resumenSemanal.serie.length > 1 && (
                <svg width="100%" height="44" viewBox="0 0 300 44" preserveAspectRatio="none" style={{ display: "block", marginBottom: 12 }}>
                  <polyline
                    points={data.resumenSemanal.serie
                      .map((v, i) => {
                        const max = Math.max(1, ...data.resumenSemanal!.serie);
                        const x = (i / (data.resumenSemanal!.serie.length - 1)) * 300;
                        const y = 40 - (v / max) * 36;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#7C6FCB"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {data.resumenSemanal.areas.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {data.resumenSemanal.areas.map((ta) => (
                    <div key={ta.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ta.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#4B5065", whiteSpace: "nowrap" }}>
                        {ta.label} {ta.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ marginTop: 10, fontSize: 9.5, color: "#B8C4D9", fontWeight: 600 }}>
                {data.resumenSemanal.serie.length > 1 ? "Consultas en PQRSF DATA, últimos 6 días. " : ""}
                Distribución de actividad real entre tus módulos este mes.
              </p>
            </div>
          )}

          {modulos.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 22, padding: 40, textAlign: "center", boxShadow: "0 4px 20px rgba(43,35,79,0.05)" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1535" }}>No tienes módulos asignados</p>
              <p style={{ marginTop: 6, fontSize: 13, color: "#9AA0AC" }}>Contacta a un administrador para habilitar tus accesos.</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 20, boxShadow: "0 4px 20px rgba(43,35,79,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1A1535" }}>{mesLabel}</span>
              <div style={{ display: "flex", gap: 6, color: "#B8C4D9" }}>
                <ChevronLeft size={13} />
                <ChevronRight size={13} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, textAlign: "center" }}>
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: "#B8C4D9", paddingBottom: 6 }}>
                  {d}
                </span>
              ))}
              {calDias.map((n) => {
                const esHoy = n === diaActual;
                return (
                  <span
                    key={n}
                    style={{
                      fontSize: 11,
                      fontWeight: esHoy ? 800 : 600,
                      color: esHoy ? "#fff" : "#4B5065",
                      background: esHoy ? "#2B234F" : "transparent",
                      borderRadius: 8,
                      padding: "5px 0",
                    }}
                  >
                    {n}
                  </span>
                );
              })}
            </div>
          </div>

          <div id="pendientes" style={{ background: "#fff", borderRadius: 22, boxShadow: "0 4px 20px rgba(43,35,79,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1A1535" }}>Pendientes</span>
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {tareas.length === 0 ? (
                <div style={{ padding: "24px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1A1535" }}>Sin pendientes por ahora</p>
                  <p style={{ marginTop: 4, fontSize: 11, color: "#9AA0AC" }}>Estás al día.</p>
                </div>
              ) : (
                tareas.map((a, i) => (
                  <Link
                    key={a.id}
                    href={a.moduloHref}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "12px 20px",
                      borderTop: i === 0 ? "none" : "1px solid rgba(23,19,33,0.06)",
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(204,255,0,0.18)", color: "#5D8A00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Clock3 size={15} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1A1535", lineHeight: 1.3 }}>{a.titulo}</div>
                      <div style={{ fontSize: 10, color: "#9AA0AC", fontWeight: 600, marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: PRIORIDAD_DOT[a.prioridad], flexShrink: 0 }} />
                        {a.moduloNombre} {a.fecha ? `· ${a.fecha}` : ""}
                      </div>
                    </div>
                    <span style={{ color: "#C4C9D6", fontSize: 13 }}>›</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1080px) {
          .home-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
