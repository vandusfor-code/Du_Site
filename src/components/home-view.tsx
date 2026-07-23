"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, LogOut, Search } from "lucide-react";
import type { Modulo } from "@/lib/modulos";
import { MODULO_VISUALS } from "@/components/module-icons";
import { CountUp } from "@/components/count-up";

function saludoPorHora(h: number): string {
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const initial = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  if (!now) {
    return <div className="h-9 w-36" aria-hidden="true" />;
  }

  const fecha = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const hora = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
      <div className="leading-tight">
        <p className="font-mono text-[13px] font-bold tabular-nums text-foreground">{hora}</p>
        <p className="text-[11px] font-medium capitalize text-faint">{fecha}</p>
      </div>
    </div>
  );
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
}: {
  nombre: string;
  modulos: Modulo[];
  logoutAction: () => void;
}) {
  const saludo = useSaludo();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar módulos..."
              className="w-full rounded-md border border-border bg-surface-inset py-2 pl-9 pr-12 text-[13px] font-medium text-foreground outline-none transition-colors placeholder:text-faint focus:border-border-strong focus:bg-surface"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-faint">
              ⌘K
            </kbd>
          </div>

          <div className="flex items-center gap-4">
            <LiveClock />

            <button
              type="button"
              title="Notificaciones"
              className="grid size-9 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-muted transition-colors hover:border-brand/30 hover:text-brand"
            >
              <Bell size={16} />
            </button>

            <div className="hidden items-center gap-2.5 border-l border-border pl-4 sm:flex">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-brand-foreground">
                {inicial}
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface"
                  style={{ background: "var(--success)" }}
                  aria-hidden="true"
                />
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-foreground">{nombre}</p>
                <p className="text-[11px] font-medium text-faint">En línea</p>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px] font-semibold text-muted transition-colors hover:border-[color:var(--error)]/30 hover:bg-error-bg hover:text-error"
              >
                <LogOut size={15} />
                <span className="hidden md:inline">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        {/* Greeting */}
        <div className="relative animate-enter overflow-hidden">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-brand">
            Portal de Gestión
          </p>
          <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-foreground lg:text-[38px]">
            {saludo}, {primerNombre} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 max-w-xl text-pretty text-[15px] leading-relaxed text-muted">
            Selecciona el módulo con el que deseas trabajar hoy. Tu acceso está
            personalizado según tu rol en la operación.
          </p>

          <svg
            className="pointer-events-none absolute -right-4 -top-6 hidden opacity-70 sm:block"
            width="220"
            height="110"
            viewBox="0 0 220 110"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 78C34 78 34 30 64 30C94 30 94 62 124 62C154 62 154 12 184 12C198 12 204 18 216 24"
              stroke="var(--accent-deep)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.55"
            />
            <circle cx="216" cy="24" r="5" fill="var(--accent)" />
          </svg>
        </div>

        {/* Module grid */}
        {modulos.length === 0 ? (
          <div
            className="animate-enter mt-10 rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center"
            style={{ animationDelay: "0.1s" }}
          >
            <p className="text-[15px] font-semibold text-foreground">
              No tienes módulos asignados
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Contacta a un administrador para habilitar tus accesos.
            </p>
          </div>
        ) : modulosFiltrados.length === 0 ? (
          <div className="animate-enter mt-10 rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center">
            <p className="text-[15px] font-semibold text-foreground">
              Sin resultados para &quot;{query}&quot;
            </p>
            <p className="mt-1 text-[13px] text-muted">Prueba con otro término de búsqueda.</p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modulosFiltrados.map((modulo, i) => {
              const visual = MODULO_VISUALS[modulo.id];
              const Icon = visual.icon;
              return (
                <Link
                  key={modulo.id}
                  href={modulo.href}
                  className="group animate-enter relative flex flex-col overflow-hidden rounded-lg border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]"
                  style={{
                    animationDelay: `${0.08 + i * 0.07}s`,
                    borderColor: `color-mix(in srgb, ${visual.tint} 22%, var(--border))`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="grid size-12 place-items-center rounded-md transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${visual.tint} 18%, transparent)`,
                        color: visual.tint,
                      }}
                    >
                      <Icon size={24} strokeWidth={2} />
                    </span>
                    <ArrowUpRight
                      size={20}
                      className="text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>

                  <h2 className="mt-5 text-[17px] font-bold tracking-tight text-foreground">
                    {modulo.nombre}
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    {modulo.descripcion}
                  </p>

                  <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                    <span className="relative flex size-2">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ backgroundColor: "var(--success)" }}
                      />
                      <span
                        className="relative inline-flex size-2 rounded-full"
                        style={{ backgroundColor: "var(--success)" }}
                      />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Disponible
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick summary — only real, honest data */}
        {modulos.length > 0 && (
          <div
            className="animate-enter mt-8 flex flex-wrap items-center gap-6 rounded-lg border border-border bg-surface px-6 py-5 shadow-[var(--shadow-card)]"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid size-10 place-items-center rounded-md text-brand"
                style={{ backgroundColor: "var(--brand-tint)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              <div className="leading-tight">
                <p className="text-lg font-extrabold text-foreground">
                  <CountUp value={modulos.length} duration={900} />
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Módulos asignados
                </p>
              </div>
            </div>

            <div className="h-9 w-px bg-border" aria-hidden="true" />

            <div className="flex items-center gap-3">
              <span
                className="grid size-10 place-items-center rounded-md"
                style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}
              >
                <span className="relative flex size-2.5">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ backgroundColor: "var(--success)" }}
                  />
                  <span
                    className="relative inline-flex size-2.5 rounded-full"
                    style={{ backgroundColor: "var(--success)" }}
                  />
                </span>
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-extrabold text-foreground">Sesión activa</p>
                <p className="text-[11px] font-medium text-faint">{nombre}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
