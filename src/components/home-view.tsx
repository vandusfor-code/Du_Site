"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import type { Modulo } from "@/lib/modulos";
import { MODULO_VISUALS } from "@/components/module-icons";
import { BrandLogo } from "@/components/brand-logo";

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
    // Reserve space to avoid layout shift before hydration
    return <div className="h-[42px] w-40" aria-hidden="true" />;
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
    <div className="text-right">
      <p className="font-mono text-lg font-bold tabular-nums tracking-tight text-foreground">
        {hora}
      </p>
      <p className="text-[12px] font-medium capitalize text-muted">{fecha}</p>
    </div>
  );
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
  const [saludo, setSaludo] = useState("Bienvenido");
  const primerNombre = nombre.split(" ")[0] || nombre;

  useEffect(() => {
    const id = setTimeout(() => setSaludo(saludoPorHora(new Date().getHours())), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <BrandLogo size={38} showWordmark />
          <div className="flex items-center gap-5">
            <LiveClock />
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:border-[color:var(--error)]/30 hover:bg-error-bg hover:text-error"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        {/* Greeting */}
        <div className="animate-enter">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-brand">
            Portal de Gestión
          </p>
          <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-foreground lg:text-[38px]">
            {saludo}, {primerNombre}
          </h1>
          <p className="mt-2 max-w-xl text-pretty text-[15px] leading-relaxed text-muted">
            Selecciona el módulo con el que deseas trabajar hoy. Tu acceso está
            personalizado según tu rol en la operación.
          </p>
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
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((modulo, i) => {
              const visual = MODULO_VISUALS[modulo.id];
              const Icon = visual.icon;
              return (
                <Link
                  key={modulo.id}
                  href={modulo.href}
                  className="group animate-enter relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[var(--shadow-hover)]"
                  style={{ animationDelay: `${0.08 + i * 0.07}s` }}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="grid size-12 place-items-center rounded-md transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${visual.tint} 12%, transparent)`,
                        color: visual.tint,
                      }}
                    >
                      <Icon size={24} strokeWidth={1.9} />
                    </span>
                    <ArrowUpRight
                      size={20}
                      className="text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
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
      </main>
    </div>
  );
}
