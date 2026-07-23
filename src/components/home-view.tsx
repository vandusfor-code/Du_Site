"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, CheckCircle2, ChevronDown, ClipboardCheck, GraduationCap, LogOut, Search } from "lucide-react";
import type { Modulo } from "@/lib/modulos";
import { MODULO_VISUALS } from "@/components/module-icons";
import { CountUp } from "@/components/count-up";

export interface Pendientes {
  /** Auditorías del mes sin compromiso de mejora firmado (undefined = módulo Métricas no asignado) */
  auditorias?: number;
  /** Cursos/simulaciones de DuAcademy asignados sin nota registrada (undefined = módulo no asignado) */
  duacademy?: number;
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
  const [saludo, setSaludo] = useState("Bienvenido");
  useEffect(() => {
    const id = setTimeout(() => setSaludo(saludoPorHora(new Date().getHours())), 0);
    return () => clearTimeout(id);
  }, []);
  return saludo;
}

export function HomeView({
  nombre,
  modulos,
  logoutAction,
  pendientes,
}: {
  nombre: string;
  modulos: Modulo[];
  logoutAction: () => void;
  pendientes?: Pendientes;
}) {
  const saludo = useSaludo();
  const now = useNow();
  const primerNombre = nombre.split(" ")[0] || nombre;
  const inicial = (nombre.trim().charAt(0) || "?").toUpperCase();

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const modulosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modulos;
    return modulos.filter(
      (m) => m.nombre.toLowerCase().includes(q) || m.descripcion.toLowerCase().includes(q)
    );
  }, [modulos, query]);

  const hora = now
    ? new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now)
    : "--:--:--";
  const fecha = now
    ? new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(now)
    : "";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1600px]">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eef0f5] px-6 py-4 lg:px-12">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa0ac]" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar módulos, reportes..."
              className="w-full rounded-full border border-[#eef0f5] bg-[#f5f6fa] py-2.5 pl-9 pr-14 text-[13px] font-medium text-[#14142b] outline-none transition-colors placeholder:text-[#9aa0ac] focus:border-[#d8d9e6] focus:bg-white"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9aa0ac]">
              ⌘K
            </kbd>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-2 sm:flex">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0ac" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              <div className="leading-tight">
                <p className="font-mono text-[13px] font-bold tabular-nums text-[#14142b]">{hora}</p>
                <p className="text-[11px] font-medium capitalize text-[#9aa0ac]">{fecha}</p>
              </div>
            </div>

            <button
              type="button"
              title="Notificaciones"
              className="grid size-9 shrink-0 place-items-center rounded-full text-[#6b7280] transition-colors hover:bg-[#f5f6fa] hover:text-[#2b234f]"
            >
              <Bell size={17} />
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#2b234f] text-[13px] font-bold text-white">
                {inicial}
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[#22c55e]"
                  aria-hidden="true"
                />
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-[#14142b]">{nombre}</p>
              </div>
              <ChevronDown size={14} className="text-[#9aa0ac]" />
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full border border-[#e5e7ef] bg-white px-4 py-2 text-[13px] font-semibold text-[#14142b] transition-colors hover:border-[#fda4af] hover:bg-[#fff1f2] hover:text-[#e11d48]"
              >
                <LogOut size={15} />
                <span className="hidden md:inline">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </header>

        <main className="px-6 py-9 sm:px-9 sm:py-11 lg:px-12">
          {/* Greeting */}
          <div className="relative animate-enter overflow-hidden">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#6d5fd4]">
              Portal de Gestión
            </p>
            <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-[#14142b] lg:text-[36px]">
              {saludo}, {primerNombre} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-[15px] leading-relaxed text-[#6b7280]">
              Selecciona el módulo con el que deseas trabajar hoy. Tu acceso está
              personalizado según tu rol en la operación.
            </p>

            <svg
              className="pointer-events-none absolute -right-2 -top-4 hidden opacity-80 sm:block"
              width="200"
              height="100"
              viewBox="0 0 200 100"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 72C32 72 32 26 58 26C84 26 84 56 110 56C136 56 136 10 162 10C174 10 180 15 190 20"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.6"
              />
              <circle cx="190" cy="20" r="14" fill="#f0fdf4" />
              <svg x="180" y="10" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.2} strokeLinecap="round">
                <path d="M4 20V10" />
                <path d="M12 20V4" />
                <path d="M20 20v-7" />
              </svg>
            </svg>
          </div>

          {/* Module grid + pending tasks */}
          <div className="mt-9 lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-6">
          {modulos.length === 0 ? (
            <div className="animate-enter rounded-2xl border border-dashed border-[#e5e7ef] bg-[#f9fafb] p-10 text-center" style={{ animationDelay: "0.1s" }}>
              <p className="text-[15px] font-semibold text-[#14142b]">No tienes módulos asignados</p>
              <p className="mt-1 text-[13px] text-[#6b7280]">Contacta a un administrador para habilitar tus accesos.</p>
            </div>
          ) : modulosFiltrados.length === 0 ? (
            <div className="animate-enter rounded-2xl border border-dashed border-[#e5e7ef] bg-[#f9fafb] p-10 text-center">
              <p className="text-[15px] font-semibold text-[#14142b]">Sin resultados para &quot;{query}&quot;</p>
              <p className="mt-1 text-[13px] text-[#6b7280]">Prueba con otro término de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {modulosFiltrados.map((modulo, i) => {
                const visual = MODULO_VISUALS[modulo.id];
                const Icon = visual.icon;
                return (
                  <Link
                    key={modulo.id}
                    href={modulo.href}
                    className="group animate-enter relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1"
                    style={{
                      animationDelay: `${0.08 + i * 0.07}s`,
                      borderColor: `color-mix(in srgb, ${visual.tint} 28%, #eef0f5)`,
                      boxShadow: "0 1px 3px rgba(43,35,79,0.04), 0 10px 30px rgba(43,35,79,0.05)",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className="grid size-12 place-items-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${visual.tint} 16%, white)`,
                          color: visual.tint,
                        }}
                      >
                        <Icon size={24} strokeWidth={2.1} />
                      </span>
                      <span
                        className="grid size-8 place-items-center rounded-full border transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        style={{
                          borderColor: `color-mix(in srgb, ${visual.tint} 40%, transparent)`,
                          color: visual.tint,
                        }}
                      >
                        <ArrowUpRight size={15} />
                      </span>
                    </div>

                    <h2 className="mt-5 text-[16px] font-bold tracking-tight text-[#14142b]">{modulo.nombre}</h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b7280]">{modulo.descripcion}</p>

                    <div className="mt-5 flex items-center gap-2">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-[#22c55e]" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">Disponible</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {pendientes && (pendientes.auditorias !== undefined || pendientes.duacademy !== undefined) && (
            <aside
              className="animate-enter mt-5 rounded-2xl border border-[#eef0f5] bg-[#f9fafb] p-5 lg:mt-0"
              style={{ animationDelay: "0.2s" }}
            >
              <h2 className="text-[13px] font-bold text-[#14142b]">Tareas pendientes</h2>
              <div className="mt-4 flex flex-col gap-3">
                {pendientes.auditorias !== undefined && (
                  <Link
                    href="/modulos/metricas"
                    className="flex items-start gap-3 rounded-xl border border-[#eef0f5] bg-white p-3.5 transition-colors hover:border-[#d8d9e6]"
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg"
                      style={{
                        backgroundColor: pendientes.auditorias > 0 ? "#fef3c7" : "#dcfce7",
                        color: pendientes.auditorias > 0 ? "#b45309" : "#16a34a",
                      }}
                    >
                      {pendientes.auditorias > 0 ? <ClipboardCheck size={17} /> : <CheckCircle2 size={17} />}
                    </span>
                    <div className="leading-tight">
                      <p className="text-[13px] font-bold text-[#14142b]">
                        {pendientes.auditorias > 0
                          ? `${pendientes.auditorias} auditoría${pendientes.auditorias === 1 ? "" : "s"} pendiente${pendientes.auditorias === 1 ? "" : "s"}`
                          : "Auditorías al día"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6b7280]">
                        {pendientes.auditorias > 0 ? "Firma tu compromiso de mejora" : "Sin compromisos por firmar"}
                      </p>
                    </div>
                  </Link>
                )}

                {pendientes.duacademy !== undefined && (
                  <Link
                    href="/modulos/quiz"
                    className="flex items-start gap-3 rounded-xl border border-[#eef0f5] bg-white p-3.5 transition-colors hover:border-[#d8d9e6]"
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg"
                      style={{
                        backgroundColor: pendientes.duacademy > 0 ? "#fce7f3" : "#dcfce7",
                        color: pendientes.duacademy > 0 ? "#e11d48" : "#16a34a",
                      }}
                    >
                      {pendientes.duacademy > 0 ? <GraduationCap size={17} /> : <CheckCircle2 size={17} />}
                    </span>
                    <div className="leading-tight">
                      <p className="text-[13px] font-bold text-[#14142b]">
                        {pendientes.duacademy > 0
                          ? `${pendientes.duacademy} módulo${pendientes.duacademy === 1 ? "" : "s"} de DuAcademy`
                          : "DuAcademy al día"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6b7280]">
                        {pendientes.duacademy > 0 ? "Tienes formación por completar" : "Sin formación pendiente"}
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            </aside>
          )}
          </div>

          {/* Quick summary — only real, honest data */}
          {modulos.length > 0 && (
            <div
              className="animate-enter mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-[#f7f8fb] px-7 py-5"
              style={{ animationDelay: "0.35s" }}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#dcfce7] text-[#16a34a]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20V10" />
                    <path d="M12 20V4" />
                    <path d="M20 20v-7" />
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-lg font-extrabold text-[#14142b]">
                    <CountUp value={modulos.length} duration={900} />
                  </p>
                  <p className="text-[11px] font-semibold text-[#6b7280]">Módulos asignados</p>
                </div>
              </div>

              <div className="hidden h-9 w-px bg-[#e5e7ef] sm:block" aria-hidden="true" />

              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#ede9fe] text-[#7c3aed]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-[15px] font-extrabold tabular-nums text-[#14142b]">{hora.slice(0, 5)}</p>
                  <p className="text-[11px] font-semibold capitalize text-[#6b7280]">{fecha}</p>
                </div>
              </div>

              <div className="hidden h-9 w-px bg-[#e5e7ef] sm:block" aria-hidden="true" />

              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#ecfdf5] text-[#22c55e]">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-[#22c55e]" />
                  </span>
                </span>
                <div className="leading-tight">
                  <p className="text-[13px] font-extrabold text-[#14142b]">Sesión activa</p>
                  <p className="text-[11px] font-medium text-[#6b7280]">{nombre}</p>
                </div>
              </div>

              <div className="hidden h-9 w-px bg-[#e5e7ef] sm:block" aria-hidden="true" />

              <div className="ml-auto flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#fff7ed] text-[#ea580c]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2.9 6.3 6.9.9-5 4.9 1.2 6.9-6-3.2-6 3.2 1.2-6.9-5-4.9 6.9-.9L12 2z" />
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-[13px] font-extrabold text-[#14142b]">People BPO</p>
                  <p className="text-[11px] font-medium text-[#6b7280]">Portal v4.0</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
