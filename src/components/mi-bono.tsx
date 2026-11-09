"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, X, Check, Minus, PartyPopper } from "lucide-react";
import type { MiBono } from "@/lib/mi-bono";

// Confeti liviano en canvas (sin librerías). Cae ~6s y se limpia solo.
function lanzarConfeti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  };
  resize();
  const colores = ["#7c3aed", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6", "#eab308", "#06b6d4"];
  const N = 180;
  const parts = Array.from({ length: N }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    w: (Math.random() * 7 + 5) * dpr,
    h: (Math.random() * 5 + 4) * dpr,
    c: colores[Math.floor(Math.random() * colores.length)],
    vy: (Math.random() * 2.5 + 1.8) * dpr,
    vx: (Math.random() * 2 - 1) * dpr,
    rot: Math.random() * Math.PI,
    vr: Math.random() * 0.2 - 0.1,
  }));
  let frame = 0;
  const maxFrames = 60 * 7;
  let raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const opacidad = frame > maxFrames - 90 ? Math.max(0, (maxFrames - frame) / 90) : 1;
    ctx.globalAlpha = opacidad;
    for (const p of parts) {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.vr;
      if (p.y > canvas.height + 20) {
        p.y = -10 * dpr;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (frame < maxFrames) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function MiBonoCard({ miBono }: { miBono: MiBono | null }) {
  const [abierto, setAbierto] = useState(false);
  if (!miBono) return null;

  return (
    <>
      <button type="button" className="miBonoCard" onClick={() => setAbierto(true)}>
        <span className="miBonoGift">
          <Gift size={26} />
        </span>
        <span className="miBonoCardText">
          <b>¡Tu bono de {miBono.mesLabel} está listo! 🎉</b>
          <small>Toca para ver tu reconocimiento</small>
        </span>
        <span className="miBonoCardGo">Ver mi bono</span>
      </button>

      {abierto && <MiBonoModal miBono={miBono} onClose={() => setAbierto(false)} />}
    </>
  );
}

function MiBonoModal({ miBono, onClose }: { miBono: MiBono; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const primerNombre = miBono.nombre.split(" ")[0] || miBono.nombre;

  useEffect(() => {
    const cv = canvasRef.current;
    const limpiar = cv ? lanzarConfeti(cv) : undefined;
    return () => limpiar?.();
  }, []);

  return (
    <div className="miBonoOverlay" onClick={onClose}>
      <canvas ref={canvasRef} className="miBonoConfeti" aria-hidden="true" />
      <div className="miBonoModal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="miBonoClose" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="miBonoHero">
          <PartyPopper size={40} />
        </div>
        <h2 className="miBonoTitulo">¡Felicitaciones, {primerNombre}!</h2>
        <p className="miBonoFrase">{miBono.frase}</p>

        <div className="miBonoMonto">{miBono.totalLabel}</div>
        <p className="miBonoSub">
          Bono de <b>{miBono.mesLabel}</b> · {miBono.area}
        </p>

        <div className="miBonoDesglose">
          {miBono.detalle.map((d) => (
            <div key={d.campo} className={`miBonoItem ${d.cumple ? "ok" : "no"}`}>
              <span className="miBonoItemIcon">{d.cumple ? <Check size={14} /> : <Minus size={14} />}</span>
              <span className="miBonoItemLabel">{d.label}</span>
              <span className="miBonoItemValor">{d.valor === null ? "—" : `${d.valor}%`}</span>
              <span className="miBonoItemMonto">{d.cumple ? d.montoLabel : "—"}</span>
            </div>
          ))}
        </div>

        <button type="button" className="miBonoBtn" onClick={onClose}>
          ¡Gracias! 💚
        </button>
      </div>
    </div>
  );
}
