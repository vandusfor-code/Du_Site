// Diseño sonoro sintetizado en el navegador (sin archivos): clics de teclado, cera que se rompe,
// whoosh, campanita de éxito… Todo opcional y silenciable.
type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let activo = true;
const KEY = "cumple-sonido";

try {
  activo = localStorage.getItem(KEY) !== "0";
} catch {}

function ac(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export const sonidoActivo = () => activo;
export function setSonido(v: boolean) {
  activo = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
}
// Hay que llamarlo dentro de un gesto del usuario (toque) para que el navegador permita el audio.
export const despertar = () => {
  ac();
};

function ruido(dur: number): AudioBufferSourceNode | null {
  const c = ac();
  if (!c) return null;
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function tono(f: number, dur: number, tipo: OscillatorType = "sine", vol = 0.2, t0 = 0, f2?: number) {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + t0;
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const solo = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
  if (activo) fn(...a);
};

export const sfx = {
  // tecla de terminal
  tecla: solo(() => {
    tono(1400 + Math.random() * 500, 0.035, "square", 0.045);
  }),
  // línea completada
  check: solo(() => {
    tono(880, 0.09, "triangle", 0.1);
    tono(1320, 0.14, "triangle", 0.09, 0.07);
  }),
  // la cera se resquebraja (mantener pulsado)
  crujido: solo((p: number) => {
    const c = ac();
    if (!c || !master) return;
    const s = ruido(0.06);
    if (!s) return;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800 + p * 2400;
    const g = c.createGain();
    g.gain.value = 0.12 + p * 0.1;
    s.connect(f).connect(g).connect(master);
    s.start();
  }),
  // el sello se rompe
  rompe: solo(() => {
    const c = ac();
    if (!c || !master) return;
    const s = ruido(0.28);
    if (s) {
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 900;
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.26);
      s.connect(f).connect(g).connect(master);
      s.start();
    }
    tono(160, 0.25, "triangle", 0.3, 0, 60);
  }),
  // papel que se desliza
  whoosh: solo(() => {
    const c = ac();
    if (!c || !master) return;
    const s = ruido(0.7);
    if (!s) return;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(300, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(3200, c.currentTime + 0.55);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.28, c.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.68);
    s.connect(f).connect(g).connect(master);
    s.start();
  }),
  // éxito (acorde ascendente)
  exito: solo(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tono(f, 0.5, "triangle", 0.13, i * 0.085));
  }),
  // cohete
  cohete: solo(() => {
    tono(220, 0.7, "sawtooth", 0.08, 0, 1100);
  }),
  // brindis
  brindis: solo(() => {
    tono(2400, 0.4, "sine", 0.1);
    tono(3100, 0.35, "sine", 0.08, 0.02);
    tono(1900, 0.45, "sine", 0.07, 0.05);
  }),
  // botón / toque suave
  pop: solo(() => {
    tono(520, 0.08, "sine", 0.12, 0, 760);
  }),
  error: solo(() => {
    tono(200, 0.22, "sawtooth", 0.1, 0, 120);
  }),
};
