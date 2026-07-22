"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  /** Animation duration in ms */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Locale used to format the number (thousands separators, etc.) */
  locale?: string;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animated count-up number. Starts from 0 and eases to `value` on mount.
 * Respects prefers-reduced-motion by rendering the final value instantly.
 */
export function CountUp({
  value,
  duration = 1400,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "es-CO",
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      frame.current = requestAnimationFrame(() => setDisplay(value));
      return () => {
        if (frame.current) cancelAnimationFrame(frame.current);
      };
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(value * easeOutCubic(progress));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  const formatted = display.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
