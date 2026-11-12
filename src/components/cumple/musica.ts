"use client";
// Canción de fondo (MP3 que sube el anfitrión desde su panel).
//
// REGLA (blindada): la canción NUNCA suena en la pantalla de inicio (portada ni compilación).
// Solo puede sonar cuando se cumplen TODAS estas compuertas:
//   1) la invitación terminó la compilación y el invitado ya está en el contenido (lo decide Invitacion.tsx),
//   2) el invitado deslizó de verdad (rueda, dedo, teclado) y la posición real lo confirma,
//   3) el interruptor de sonido está activo.
// Si cualquiera falla, o si algo intenta hacerla sonar por fuera (recarga, scroll restaurado, doble toque,
// teclas multimedia…), el propio reproductor se pausa solo. Los efectos de sonido son independientes.
import { alCambiarSonido, sonidoActivo } from "./audio";

const VOL = 0.7;
let el: HTMLAudioElement | null = null;
let url = "";
let permitido = false; // compuerta general: solo Invitacion.tsx la abre
let quiere = false; // el invitado ya está en el contenido y le toca sonar
let cebado = false; // el reproductor ya se "despertó" con el primer toque (solo una vez)
let cebando = false;
let fade: ReturnType<typeof setInterval> | null = null;

const cancelaFade = () => {
  if (fade) clearInterval(fade);
  fade = null;
};

// Rampa de volumen con temporizador (sigue funcionando aunque la pestaña esté en segundo plano)
function rampa(a: HTMLAudioElement, desde: number, hasta: number, ms: number, alFinal?: () => void) {
  cancelaFade();
  const t0 = Date.now();
  fade = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, desde + (hasta - desde) * k));
    if (k >= 1) {
      cancelaFade();
      alFinal?.();
    }
  }, 40);
}

function silenciaYPara(a: HTMLAudioElement) {
  cancelaFade();
  a.muted = true;
  a.volume = 0;
  a.pause();
}

/** Reinicia todo: se llama en cada carga/descarga de la invitación. Nada sigue sonando de una visita anterior. */
export function bloquear() {
  permitido = false;
  quiere = false;
  cancelaFade();
  if (el) {
    silenciaYPara(el);
    try {
      el.currentTime = 0;
    } catch {}
  }
}

/** Crea el reproductor (en silencio y sin sonar). */
export function preparar(u: string) {
  if (!u || typeof window === "undefined") return;
  if (el && url === u) return;
  if (el) {
    silenciaYPara(el);
    el.removeAttribute("src");
    el.load();
  }
  const a = new Audio(u);
  a.loop = true;
  a.preload = "auto";
  a.muted = true;
  a.volume = 0;
  // Cinturón de seguridad: si por cualquier motivo empieza a sonar sin permiso, se detiene al instante.
  a.addEventListener("play", () => {
    if (!permitido && !cebando) silenciaYPara(a);
  });
  el = a;
  url = u;
  permitido = false;
  quiere = false;
  cebado = false;
}

/** Dentro de un toque: "despierta" el reproductor para que el navegador (sobre todo iOS) deje arrancarlo después.
 *  Se hace UNA sola vez, siempre en silencio (muted y volumen 0) y se mantiene en silencio hasta que le toque sonar. */
export function desbloquear() {
  const a = el;
  if (!a || cebado) return;
  cebado = true;
  cebando = true;
  a.muted = true;
  a.volume = 0;
  a.play()
    .then(() => {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {}
    })
    .catch(() => {})
    .finally(() => {
      cebando = false;
      if (!permitido) silenciaYPara(a);
    });
}

/** Abre la compuerta general (solo cuando el invitado ya salió de la pantalla de inicio). */
export function permitir() {
  permitido = true;
}

function subir(a: HTMLAudioElement) {
  rampa(a, 0, VOL, 2800);
}

/** Arranca la canción con fundido de entrada. Se niega si alguna compuerta está cerrada. */
export async function iniciar() {
  const a = el;
  if (!a || !permitido) return;
  quiere = true;
  if (!sonidoActivo() || !a.paused || cebando) return;
  a.volume = 0;
  a.muted = false;
  try {
    await a.play();
    if (!permitido || !quiere || !sonidoActivo()) {
      silenciaYPara(a);
      return;
    }
    subir(a);
  } catch {
    a.muted = true;
    /* el navegador no lo permitió: se reintenta con el siguiente toque real */
    const reintento = () => {
      window.removeEventListener("pointerdown", reintento);
      if (permitido && quiere && sonidoActivo()) iniciar();
    };
    window.addEventListener("pointerdown", reintento, { once: true });
  }
}

/** Pausa con fundido de salida (por ejemplo al volver a la pantalla de inicio). */
export function pausar() {
  quiere = false;
  permitido = false; // al volver a la pantalla de inicio la compuerta se cierra y hay que ganarla otra vez
  const a = el;
  if (!a || a.paused) return;
  rampa(a, a.volume, 0, 600, () => {
    if (!quiere) silenciaYPara(a);
  });
}

if (typeof window !== "undefined") {
  // el botón de sonido controla también la canción
  alCambiarSonido((v) => {
    const a = el;
    if (!a || !permitido || !quiere) return;
    if (v) iniciar();
    else silenciaYPara(a);
  });
  // si la pestaña pasa a segundo plano, la canción se pausa; al volver, sigue solo si le toca
  document.addEventListener("visibilitychange", () => {
    const a = el;
    if (!a || !permitido || !quiere) return;
    if (document.hidden) a.pause();
    else if (sonidoActivo()) {
      a.muted = false;
      a.play().catch(() => {});
    }
  });
  // al salir de la página o al volver desde el historial (bfcache), todo queda en silencio y bloqueado
  window.addEventListener("pagehide", bloquear);
  window.addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted) bloquear();
  });
}
