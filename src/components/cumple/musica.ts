"use client";
// Canción de fondo (MP3 que sube el anfitrión desde su panel).
// Empieza a sonar cuando el invitado desliza después de la compilación; los efectos de sonido
// (terminal, clics, confeti…) siguen sonando por encima mientras la canción se reproduce.
import { alCambiarSonido, sonidoActivo } from "./audio";

const VOL = 0.7;
let el: HTMLAudioElement | null = null;
let url = "";
let quiere = false; // ya le tocaba sonar (el invitado deslizó)
let fade = 0;

/** Crea el reproductor (todavía en silencio y sin sonar). */
export function preparar(u: string) {
  if (!u || typeof window === "undefined") return;
  if (el && url === u) return;
  if (el) el.pause();
  el = new Audio(u);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  url = u;
  quiere = false;
}

/** Hay que llamarlo dentro de un toque: así el navegador (sobre todo iOS) permite arrancar la canción más tarde. */
export function desbloquear() {
  const a = el;
  if (!a) return;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
    });
}

function subir() {
  const a = el;
  if (!a) return;
  cancelAnimationFrame(fade);
  const t0 = performance.now();
  const paso = (t: number) => {
    const k = Math.min(1, (t - t0) / 2800);
    a.volume = VOL * k;
    if (k < 1) fade = requestAnimationFrame(paso);
  };
  fade = requestAnimationFrame(paso);
}

/** Arranca la canción con un fundido de entrada (si el sonido está activado). */
export async function iniciar() {
  const a = el;
  if (!a) return;
  quiere = true;
  if (!sonidoActivo() || !a.paused) return;
  a.volume = 0;
  a.muted = false;
  try {
    await a.play();
    subir();
  } catch {
    /* el navegador no lo permitió: se reintenta con el siguiente toque */
    const reintento = () => {
      window.removeEventListener("pointerdown", reintento);
      if (quiere && sonidoActivo()) iniciar();
    };
    window.addEventListener("pointerdown", reintento, { once: true });
  }
}

export const hayMusica = () => !!el;

if (typeof window !== "undefined") {
  // el botón de sonido controla también la canción
  alCambiarSonido((v) => {
    const a = el;
    if (!a || !quiere) return;
    if (v) iniciar();
    else {
      cancelAnimationFrame(fade);
      a.pause();
    }
  });
  // si la pestaña pasa a segundo plano, la canción se pausa
  document.addEventListener("visibilitychange", () => {
    const a = el;
    if (!a || !quiere) return;
    if (document.hidden) a.pause();
    else if (sonidoActivo()) a.play().catch(() => {});
  });
}
