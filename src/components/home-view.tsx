"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, ChevronDown, Clock3, LogOut } from "lucide-react";
import type { Modulo, ModuloId } from "@/lib/modulos";
import { MODULO_VISUALS } from "@/components/module-icons";

export interface TareaPendiente {
  id: string;
  titulo: string;
  moduloId: ModuloId;
  moduloNombre: string;
  moduloHref: string;
  /** Vacío cuando el origen no tiene una fecha asociada (ej. formación pendiente) */
  fecha: string;
  prioridad: "Alta" | "Media" | "Baja";
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

function FlowGraphic() {
  return (
    <div className="relative hidden h-[150px] lg:block">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle, rgba(114,87,255,0.08), transparent 65%)" }}
        aria-hidden="true"
      />
      <svg viewBox="0 0 600 180" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <path
          d="M20 110 C120 30, 160 155, 260 80 S420 45, 580 105"
          stroke="var(--home-purple)"
          strokeWidth="1.5"
          opacity="0.55"
        />
        <path
          d="M40 130 C150 150, 170 40, 290 105 S440 150, 570 45"
          stroke="var(--home-lime)"
          strokeWidth="1.4"
          opacity="0.5"
        />
        <path
          d="M70 90 C180 45, 220 130, 330 70 S470 65, 560 110"
          stroke="#2bb9a7"
          strokeWidth="1"
          opacity="0.25"
        />
        <circle cx="160" cy="85" r="4" fill="var(--home-purple)" />
        <circle cx="290" cy="105" r="4" fill="var(--home-lime)" />
        <circle cx="445" cy="74" r="3" fill="var(--home-purple)" />
      </svg>
    </div>
  );
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
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-[var(--home-indigo)] text-[13px] font-bold text-white">
          {inicial}
          <span
            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[var(--home-green)]"
            aria-hidden="true"
          />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold text-[var(--home-ink)]">{nombre}</span>
        </span>
        <ChevronDown size={15} className={`hidden text-[var(--home-ink-muted)] transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-52 overflow-hidden rounded-[14px] border border-[var(--home-border)] bg-white shadow-[var(--home-shadow-md)]">
          <div className="border-b border-[var(--home-border)] px-4 py-3">
            <p className="truncate text-[13px] font-bold text-[var(--home-ink)]">{nombre}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] font-semibold text-[#e11d48] transition-colors hover:bg-[#fff1f2]"
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

const PRIORIDAD_STYLE: Record<TareaPendiente["prioridad"], string> = {
  Alta: "bg-red-50 text-red-500",
  Media: "bg-amber-50 text-amber-600",
  Baja: "bg-emerald-50 text-emerald-600",
};

function TaskItem({ tarea, last }: { tarea: TareaPendiente; last: boolean }) {
  const visual = MODULO_VISUALS[tarea.moduloId];
  const Icon = visual.icon;
  return (
    <Link
      href={tarea.moduloHref}
      className={`flex gap-3 px-6 py-4 text-left transition-colors hover:bg-[var(--home-surface-soft)] ${!last ? "border-b border-[var(--home-border)]" : ""}`}
    >
      <span
        className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-[12px]"
        style={{ backgroundColor: visual.accentBg, color: visual.accentFg }}
      >
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--home-ink)]">{tarea.titulo}</p>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${PRIORIDAD_STYLE[tarea.prioridad]}`}>
            {tarea.prioridad}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--home-ink-muted)]">{tarea.moduloNombre}</p>
        {tarea.fecha && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--home-ink-muted)]">
            <Clock3 size={11} />
            {tarea.fecha}
          </div>
        )}
      </div>
    </Link>
  );
}

function ModuleCard({ modulo }: { modulo: Modulo }) {
  const visual = MODULO_VISUALS[modulo.id];
  const Icon = visual.icon;
  return (
    <Link
      href={modulo.href}
      className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-[22px] border border-[var(--home-border)] bg-white/80 p-6 shadow-[var(--home-shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(90,70,200,0.15)] hover:shadow-[0_16px_40px_rgba(30,35,60,0.08)]"
    >
      <span
        className="grid size-12 place-items-center rounded-[14px]"
        style={{ backgroundColor: visual.accentBg, color: visual.accentFg }}
      >
        <Icon size={22} strokeWidth={1.9} />
      </span>

      <h4 className="mt-5 text-[17px] font-bold tracking-tight text-[var(--home-ink)]">{modulo.nombre}</h4>
      <p className="mt-2 max-w-[290px] text-[13px] leading-5 text-[var(--home-ink-secondary)]">{modulo.descripcion}</p>

      <span className="absolute bottom-5 right-5 grid size-9 place-items-center rounded-full border border-[var(--home-border)] bg-white text-[var(--home-purple)] transition-transform duration-200 group-hover:translate-x-0.5">
        <ArrowUpRight size={16} />
      </span>
    </Link>
  );
}

function MetricasFeaturedCard({ modulo }: { modulo: Modulo }) {
  const visual = MODULO_VISUALS.metricas;
  const Icon = visual.icon;
  return (
    <Link
      href={modulo.href}
      className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-[22px] p-6 text-white shadow-[0_18px_45px_rgba(35,25,75,0.16)] transition duration-200 hover:-translate-y-0.5"
      style={{ background: "linear-gradient(145deg, var(--home-indigo), var(--home-indigo-deep))" }}
    >
      <span className="grid size-12 place-items-center rounded-[14px] bg-white/10" style={{ color: visual.accentFg }}>
        <Icon size={22} strokeWidth={1.9} />
      </span>

      <h4 className="mt-5 text-[18px] font-bold tracking-tight">{modulo.nombre}</h4>
      <p className="mt-2 max-w-[260px] text-[13px] leading-5 text-white/65">{modulo.descripcion}</p>

      <svg viewBox="0 0 200 60" className="pointer-events-none absolute bottom-7 right-6 h-[64px] w-[160px]" aria-hidden="true">
        <path
          d="M5 50 C35 45,45 35,70 38 S105 25,125 30 S160 15,195 8"
          fill="none"
          stroke="var(--home-lime)"
          strokeWidth="2"
          opacity="0.9"
        />
      </svg>

      <span
        className="absolute bottom-5 left-6 grid size-9 place-items-center rounded-full text-[var(--home-indigo-deep)] transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ backgroundColor: "var(--home-lime)" }}
      >
        <ArrowUpRight size={16} />
      </span>
    </Link>
  );
}

export function HomeView({
  nombre,
  modulos,
  logoutAction,
  tareas,
}: {
  nombre: string;
  modulos: Modulo[];
  logoutAction: () => void;
  tareas: TareaPendiente[];
}) {
  const saludo = useSaludo();
  const now = useNow();
  const primerNombre = nombre.split(" ")[0] || nombre;

  const hora = now
    ? new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }).format(now)
    : "--:--";
  const fecha = now
    ? new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(now)
    : "";

  const metricas = modulos.find((m) => m.id === "metricas");
  const otrosModulos = modulos.filter((m) => m.id !== "metricas");
  const alertas = tareas.filter((t) => t.prioridad === "Alta").length;

  return (
    <div className="min-h-screen bg-[var(--home-bg)] text-[var(--home-ink)]">
      {/* Header */}
      <header className="h-[78px] border-b border-[var(--home-border)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1500px] items-center justify-between px-6 sm:px-8 xl:px-12">
          <div className="flex items-center gap-3">
            <div
              className="flex size-11 items-center justify-center rounded-[14px] text-lg font-bold text-white shadow-sm"
              style={{ background: "var(--home-indigo-deep)" }}
            >
              Du
            </div>
            <div>
              <div className="text-[18px] font-bold tracking-tight text-[var(--home-ink)]">Du Site</div>
              <div className="text-[11px] font-medium text-[var(--home-ink-muted)]">Portal de Gestión</div>
            </div>
          </div>

          <div className="flex items-center gap-5 sm:gap-6">
            <div className="hidden text-right md:block">
              <div className="text-[13px] font-semibold text-[var(--home-ink)]">{hora}</div>
              <div className="text-[11px] capitalize text-[var(--home-ink-muted)]">{fecha}</div>
            </div>

            <Link
              href="#pendientes"
              title="Tareas de prioridad alta"
              className="relative grid size-10 place-items-center rounded-full text-[var(--home-ink-secondary)] transition-colors hover:bg-[var(--home-surface-soft)]"
            >
              <Bell size={18} strokeWidth={1.8} />
              {alertas > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 size-2 rounded-full"
                  style={{ background: "var(--home-lime)" }}
                  aria-hidden="true"
                />
              )}
            </Link>

            <UserMenu nombre={nombre} logoutAction={logoutAction} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 pb-16 pt-10 sm:px-8 xl:px-12" style={{ paddingLeft: "clamp(24px, 5vw, 80px)", paddingRight: "clamp(24px, 5vw, 80px)" }}>
        {/* Welcome */}
        <section className="grid min-h-[190px] grid-cols-1 items-center gap-8 pb-6 pt-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="animate-enter">
            <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--home-purple)]">
              Portal de Gestión
            </span>
            <h1 className="text-[38px] font-bold leading-[0.98] tracking-[-0.04em] text-[var(--home-ink)] sm:text-[48px]">
              {saludo}, {primerNombre}
              <span style={{ color: "var(--home-lime)", WebkitTextStroke: "0.5px rgba(0,0,0,0.15)" }}>.</span>
            </h1>
            <h2 className="mt-3 text-[17px] font-semibold text-[var(--home-ink-secondary)]">¿Qué deseas hacer hoy?</h2>
            <p className="mt-2 max-w-[440px] text-[14px] leading-6 text-[var(--home-ink-muted)]">
              Accede a tus herramientas y continúa impulsando tus resultados.
            </p>
          </div>

          <FlowGraphic />
        </section>

        {/* Workspace */}
        <section className="mt-4 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Modules */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="h-5 w-[3px] rounded-full" style={{ background: "var(--home-purple)" }} />
              <h3 className="text-[15px] font-bold text-[var(--home-ink)]">Tus módulos</h3>
            </div>

            {modulos.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[var(--home-border-strong)] bg-[var(--home-surface-soft)] p-10 text-center">
                <p className="text-[15px] font-semibold text-[var(--home-ink)]">No tienes módulos asignados</p>
                <p className="mt-1 text-[13px] text-[var(--home-ink-secondary)]">
                  Contacta a un administrador para habilitar tus accesos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {metricas && <MetricasFeaturedCard modulo={metricas} />}
                {otrosModulos.map((modulo) => (
                  <ModuleCard key={modulo.id} modulo={modulo} />
                ))}
              </div>
            )}
          </div>

          {/* Pending tasks */}
          <aside
            id="pendientes"
            className="self-start overflow-hidden rounded-[22px] border border-[var(--home-border)] bg-white shadow-[var(--home-shadow-md)]"
          >
            <div className="px-6 py-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--home-ink-muted)]">
                Tu agenda
              </span>
              <div className="mt-1 flex items-center gap-2">
                <h3 className="text-[19px] font-bold tracking-tight text-[var(--home-ink)]">Pendientes</h3>
                <span
                  className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold"
                  style={{ backgroundColor: "#ede9fe", color: "var(--home-purple)" }}
                >
                  {tareas.length}
                </span>
              </div>
            </div>

            {tareas.length === 0 ? (
              <div className="border-t border-[var(--home-border)] px-6 py-8 text-center">
                <p className="text-[13px] font-semibold text-[var(--home-ink)]">Sin pendientes por ahora</p>
                <p className="mt-1 text-[12px] text-[var(--home-ink-muted)]">Estás al día con tus módulos.</p>
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto border-t border-[var(--home-border)]">
                {tareas.map((tarea, i) => (
                  <TaskItem key={tarea.id} tarea={tarea} last={i === tareas.length - 1} />
                ))}
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
