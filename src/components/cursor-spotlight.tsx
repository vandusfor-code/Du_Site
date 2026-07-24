"use client";

import { useEffect, useRef } from "react";

export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reducedMotion || !hasHover) {
      el!.style.display = "none";
      return;
    }

    let frame = 0;
    let latestX = window.innerWidth / 2;
    let latestY = window.innerHeight / 2;

    function apply() {
      frame = 0;
      el!.style.setProperty("--x", `${(latestX / window.innerWidth) * 100}%`);
      el!.style.setProperty("--y", `${(latestY / window.innerHeight) * 100}%`);
    }

    function onMouseMove(e: MouseEvent) {
      latestX = e.clientX;
      latestY = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    }

    function onEnter() {
      el!.style.opacity = "1";
    }

    function onLeave() {
      el!.style.opacity = "0";
    }

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 z-[1] pointer-events-none opacity-100 transition-opacity duration-300 ease-out"
      style={{
        background:
          "radial-gradient(480px circle at var(--x, 50%) var(--y, 50%), color-mix(in srgb, var(--brand) 18%, transparent), transparent 70%)",
      }}
    />
  );
}
