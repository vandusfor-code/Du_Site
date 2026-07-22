import { cn } from "@/lib/cn";

interface BrandLogoProps {
  /** Size of the logo mark in px */
  size?: number;
  /** Show the "Portal de Gestión" wordmark next to the mark */
  showWordmark?: boolean;
  /** Render light text (for use on dark surfaces) */
  onDark?: boolean;
  className?: string;
}

/**
 * Brand mark for Portal de Gestión.
 * A rounded indigo tile with a lime activity glyph — no external asset needed.
 */
export function BrandLogo({
  size = 40,
  showWordmark = false,
  onDark = false,
  className,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className="relative grid shrink-0 place-items-center rounded-md shadow-[var(--shadow-brand)]"
        style={{
          width: size,
          height: size,
          background:
            "linear-gradient(145deg, var(--brand-mid), var(--brand-deep))",
        }}
        aria-hidden="true"
      >
        <svg
          width={size * 0.56}
          height={size * 0.56}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 14.5 8 9l4 4 5-6 3 3.5" />
          <circle cx="8" cy="9" r="0.6" fill="var(--accent)" />
          <circle cx="17" cy="7" r="0.6" fill="var(--accent)" />
        </svg>
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[15px] font-extrabold tracking-tight",
              onDark ? "text-white" : "text-foreground"
            )}
          >
            Portal de Gestión
          </span>
          <span
            className={cn(
              "mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
              onDark ? "text-white/45" : "text-faint"
            )}
          >
            People BPO
          </span>
        </span>
      )}
    </div>
  );
}
