"use client";
// Utilidades compartidas: giroscopio, cuenta regresiva, respuesta RSVP, calendario.
import { motionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { objetivo, urlSegura, fechaLarga, horaLarga, parseFecha, type CumpleCfg, type Invitado } from "./config";
import { rpc, notificarRespuesta } from "./api";

/* ---------- giroscopio global (−1..1) ---------- */
export const gyroX = motionValue(0);
export const gyroY = motionValue(0);
let gyroOn = false;
export function useGyro() {
  useEffect(() => {
    if (gyroOn) return;
    gyroOn = true;
    const h = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      gyroX.set(Math.max(-1, Math.min(1, e.gamma / 30)));
      gyroY.set(Math.max(-1, Math.min(1, (e.beta - 50) / 30)));
    };
    window.addEventListener("deviceorientation", h);
  }, []);
}

/* ---------- cuenta regresiva ---------- */
export function useCuenta(cfg: CumpleCfg) {
  const t = objetivo(cfg);
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (t == null || ahora == null) return null;
  const r = Math.max(0, Math.floor((t - ahora) / 1000));
  return { d: Math.floor(r / 86400), h: Math.floor((r % 86400) / 3600), m: Math.floor((r % 3600) / 60), s: r % 60, pasado: t - ahora <= 0 };
}

/* ---------- enlaces ---------- */
export function enlaceMapa(cfg: CumpleCfg) {
  if (urlSegura(cfg.mapa)) return cfg.mapa;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([cfg.lugar, cfg.dir, cfg.ciudad].filter(Boolean).join(", "))}`;
}

function fechaIcs(cfg: CumpleCfg, extraH = 0) {
  const f = parseFecha(cfg.fecha);
  if (!f) return "";
  const [h, m] = (cfg.hora || "18:00").split(":").map(Number);
  const d = new Date(f.Y, f.M - 1, f.D, (h || 0) + extraH, m || 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

export function enlaceGoogleCal(cfg: CumpleCfg) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Cumpleaños de ${cfg.anfitrion} · THE NEXT CHAPTER`,
    dates: `${fechaIcs(cfg)}/${fechaIcs(cfg, 5)}`,
    details: cfg.saludo,
    location: [cfg.lugar, cfg.ciudad].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function descargarIcs(cfg: CumpleCfg) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//THE NEXT CHAPTER//ES",
    "BEGIN:VEVENT",
    `UID:cumple-${cfg.fecha}@duacademy.site`,
    `DTSTAMP:${fechaIcs(cfg)}`,
    `DTSTART:${fechaIcs(cfg)}`,
    `DTEND:${fechaIcs(cfg, 5)}`,
    `SUMMARY:Cumpleaños de ${cfg.anfitrion}`,
    `LOCATION:${[cfg.lugar, cfg.ciudad].filter(Boolean).join(", ")}`,
    `DESCRIPTION:${cfg.saludo}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = "cumpleanos.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}

export const resumenFecha = (cfg: CumpleCfg) => `${fechaLarga(cfg.fecha)}${cfg.hora ? ` · ${horaLarga(cfg.hora)}` : ""}`;

/* ---------- respuesta RSVP (la usan la sección y la terminal) ---------- */
export interface Rsvp {
  inv: Invitado | null;
  codigo: string | null;
  estado: "pendiente" | "confirmado" | "declinado";
  asistentes: number | null;
  enviando: boolean;
  error: string;
  responder: (estado: "confirmado" | "declinado", personas?: number) => Promise<boolean>;
  puede: boolean;
}

export function useRsvp(inv: Invitado | null, codigo: string | null, preview?: boolean): Rsvp {
  const [estado, setEstado] = useState<Invitado["estado"]>(inv?.estado ?? "pendiente");
  const [asist, setAsist] = useState<number | null>(inv?.asistentes ?? null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const alVuelo = useRef(false);

  const responder = useCallback(
    async (nuevo: "confirmado" | "declinado", personas?: number) => {
      if (alVuelo.current) return false;
      const n = nuevo === "confirmado" ? Math.max(1, Math.min(inv?.pases ?? 1, personas ?? inv?.pases ?? 1)) : null;
      alVuelo.current = true;
      setEnviando(true);
      setError("");
      try {
        if (!preview && codigo) {
          await rpc("boda_invitado_responder", { p_codigo: codigo, p_estado: nuevo, p_asistentes: n });
          notificarRespuesta(codigo);
        }
        setEstado(nuevo);
        setAsist(n);
        return true;
      } catch {
        setError("No pudimos guardar tu respuesta. Revisa tu internet e inténtalo otra vez.");
        return false;
      } finally {
        alVuelo.current = false;
        setEnviando(false);
      }
    },
    [codigo, inv, preview]
  );

  return { inv, codigo, estado, asistentes: asist, enviando, error, responder, puede: !!inv || !!preview };
}
