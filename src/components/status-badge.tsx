import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
};

/**
 * Badge semántico genérico — no exclusivo de ningún módulo. Construido
 * sobre los tokens canónicos de globals.css (success/warning/error/info +
 * neutral), con soporte de modo oscuro automático porque esos tokens ya
 * lo tienen definido.
 */
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone]
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
