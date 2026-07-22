"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Panel width in px on desktop */
  width?: number;
  side?: "right" | "left";
  children: React.ReactNode;
}

/**
 * Reusable side drawer for chat, notifications and search panels.
 * Slides in with a blurred backdrop; closes on Escape or backdrop click.
 */
export function Drawer({
  open,
  onClose,
  title,
  width = 420,
  side = "right",
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-brand-deep/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width,
          maxWidth: "92vw",
          transform: open
            ? "translateX(0)"
            : side === "right"
              ? "translateX(105%)"
              : "translateX(-105%)",
        }}
        className={cn(
          "absolute top-0 flex h-full flex-col bg-surface shadow-[var(--shadow-hover)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          side === "right" ? "right-0" : "left-0"
        )}
      >
        {title && (
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-8 place-items-center rounded-sm text-muted transition-colors hover:bg-surface-inset hover:text-foreground"
            >
              <X size={18} />
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
