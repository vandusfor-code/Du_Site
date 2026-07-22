"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { BrandMark } from "@/components/brand-logo";

export type ShellNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type ModuleShellProps = {
  moduleName: string;
  moduleSubtitle?: string;
  nav: ShellNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  title: string;
  user: { nombre: string; rol?: string };
  headerRight?: ReactNode;
  children: ReactNode;
};

export function ModuleShell({
  moduleName,
  moduleSubtitle,
  nav,
  activeId,
  onNavigate,
  title,
  user,
  headerRight,
  children,
}: ModuleShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const initials = user.nombre
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-4">
          <BrandMark className="size-9 shrink-0" />
          <div
            className={cn(
              "flex min-w-0 flex-col transition-opacity duration-200",
              collapsed && "pointer-events-none opacity-0",
            )}
          >
            <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              {moduleName}
            </span>
            {moduleSubtitle ? (
              <span className="truncate text-xs font-medium text-sidebar-foreground/55">
                {moduleSubtitle}
              </span>
            ) : null}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <Icon
                  className={cn(
                    "size-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    active ? "text-primary" : "",
                  )}
                  strokeWidth={2}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left transition-opacity duration-200",
                    collapsed && "pointer-events-none opacity-0",
                  )}
                >
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && !collapsed ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {item.badge}
                  </span>
                ) : null}
                {item.badge && item.badge > 0 && collapsed ? (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* User + back */}
        <div className="border-t border-border/60 p-3">
          <div
            className={cn(
              "mb-2 flex items-center gap-3 rounded-lg px-2 py-2",
              collapsed && "justify-center px-0",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </span>
            <div
              className={cn(
                "flex min-w-0 flex-col transition-opacity duration-200",
                collapsed && "hidden",
              )}
            >
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {user.nombre}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/55">
                {user.rol ?? "Sesión activa"}
              </span>
            </div>
          </div>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? "Volver al inicio" : undefined}
          >
            <LogOut className="size-5 shrink-0 rotate-180" strokeWidth={2} />
            <span className={cn(collapsed && "hidden")}>Volver al inicio</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="truncate text-xs font-medium capitalize text-muted-foreground">
              {fecha}
            </p>
          </div>
          {headerRight}
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-foreground">
                {user.nombre}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.rol ?? "Sesión activa"}
              </p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

export function HomeShortcut() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <Home className="size-4" />
      Inicio
    </Link>
  );
}
