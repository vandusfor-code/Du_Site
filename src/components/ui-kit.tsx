"use client";

import { type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { CountUp } from "@/components/count-up";

/* ---------------------------------- Card --------------------------------- */

export function Surface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------- KPI card -------------------------------- */

type Tone = "brand" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, { chip: string; icon: string }> = {
  brand: { chip: "bg-primary/10", icon: "text-primary" },
  success: { chip: "bg-[var(--success-bg)]", icon: "text-[var(--success)]" },
  warning: { chip: "bg-[var(--warning-bg)]", icon: "text-[var(--warning)]" },
  danger: { chip: "bg-[var(--danger-bg)]", icon: "text-[var(--danger)]" },
};

export function KpiCard({
  label,
  value,
  suffix,
  prefix,
  decimals = 0,
  icon: Icon,
  tone = "brand",
  delta,
  hint,
  index = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  icon: LucideIcon;
  tone?: Tone;
  delta?: number;
  hint?: string;
  index?: number;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Surface
      className="animate-rise p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg",
            toneStyles[tone].chip,
          )}
        >
          <Icon className={cn("size-5", toneStyles[tone].icon)} strokeWidth={2} />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">
          <CountUp
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
            delay={index * 70}
          />
        </span>
        {typeof delta === "number" ? (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              positive
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--danger-bg)] text-[var(--danger)]",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-xs font-medium text-muted-foreground">{hint}</p>
      ) : null}
    </Surface>
  );
}

/* ------------------------------ Status badge ------------------------------ */

const badgeTones: Record<string, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/10 text-primary",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        badgeTones[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-[linear-gradient(90deg,transparent,var(--shimmer),transparent)] after:content-[''] after:animate-shimmer",
        className,
      )}
    />
  );
}

/* ----------------------------- Bar mini chart ----------------------------- */

export function BarChart({
  data,
  className,
}: {
  data: { label: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("flex h-44 items-end gap-3", className)}>
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-primary/85 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary"
              style={{
                height: `${(d.value / max) * 100}%`,
                animationDelay: `${i * 60}ms`,
              }}
            />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Donut chart ------------------------------- */

export function DonutChart({
  segments,
  size = 160,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={thickness}
          />
          {segments.map((seg) => {
            const len = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-[stroke-dasharray] duration-700 ease-out"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {centerValue ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">
              {centerValue}
            </span>
            {centerLabel ? (
              <span className="text-xs font-medium text-muted-foreground">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ul className="space-y-2">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="font-medium text-foreground">{seg.label}</span>
            <span className="text-muted-foreground">
              {Math.round((seg.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Gauge chart ------------------------------- */

export function Gauge({
  value,
  size = 150,
  label,
}: {
  value: number; // 0..100
  size?: number;
  label?: string;
}) {
  const thickness = 14;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75; // 270deg gauge
  const filled = (value / 100) * arc;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(135deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={thickness}
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${c}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight text-foreground">
          <CountUp value={value} suffix="%" />
        </span>
        {label ? (
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        ) : null}
      </div>
    </div>
  );
}
