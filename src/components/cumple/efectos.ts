"use client";
import confetti from "canvas-confetti";

const COL = ["#F07F13", "#FFB255", "#FFD9A8", "#2B2118", "#F6E7BE", "#E8503A", "#2E9E5B"];

export function confetiFiesta() {
  const fin = Date.now() + 900;
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 62, origin: { x: 0, y: 0.75 }, colors: COL, zIndex: 200 });
    confetti({ particleCount: 5, angle: 120, spread: 62, origin: { x: 1, y: 0.75 }, colors: COL, zIndex: 200 });
    if (Date.now() < fin) requestAnimationFrame(frame);
  };
  frame();
  confetti({ particleCount: 90, spread: 100, startVelocity: 42, origin: { x: 0.5, y: 0.65 }, colors: COL, zIndex: 200 });
}

export function confetiCerveza() {
  try {
    const cerveza = confetti.shapeFromText({ text: "🍺", scalar: 3 });
    confetti({ shapes: [cerveza], scalar: 3, particleCount: 26, spread: 100, startVelocity: 38, origin: { x: 0.5, y: 0.75 }, zIndex: 200, flat: true });
  } catch {
    confetiFiesta();
  }
}

export function confetiDesde(el: Element | null) {
  if (!el) return confetiFiesta();
  const r = el.getBoundingClientRect();
  confetti({ particleCount: 70, spread: 80, startVelocity: 36, origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, colors: COL, zIndex: 200 });
}

/** Lluvia estilo Matrix durante unos segundos. */
export function lluviaMatrix(ms = 4200) {
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:150;pointer-events:none;background:rgba(0,12,4,.82);opacity:0;transition:opacity .4s";
  c.width = innerWidth;
  c.height = innerHeight;
  document.body.appendChild(c);
  requestAnimationFrame(() => (c.style.opacity = "1"));
  const g = c.getContext("2d")!;
  const tam = 16;
  const cols = Math.ceil(c.width / tam);
  const gotas = Array.from({ length: cols }, () => Math.random() * -40);
  const glifos = "01アイウエオカキクケコ{}<>/=;$#";
  const t0 = performance.now();
  let raf = 0;
  const loop = (t: number) => {
    g.fillStyle = "rgba(0,12,4,.12)";
    g.fillRect(0, 0, c.width, c.height);
    g.font = `${tam}px monospace`;
    gotas.forEach((y, i) => {
      g.fillStyle = Math.random() > 0.96 ? "#d8ffe4" : "#2cff7a";
      g.fillText(glifos[Math.floor(Math.random() * glifos.length)], i * tam, y * tam);
      gotas[i] = y * tam > c.height && Math.random() > 0.975 ? 0 : y + 1;
    });
    if (t - t0 < ms) raf = requestAnimationFrame(loop);
    else {
      c.style.opacity = "0";
      setTimeout(() => c.remove(), 450);
    }
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    c.remove();
  };
}
