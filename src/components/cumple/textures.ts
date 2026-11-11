// Texturas dibujadas en canvas (papel, cera, carta, pantalla de código, etiqueta).
// Nada de imágenes externas: todo se genera al cargar.
import * as THREE from "three";

export const familia = (v: string, fallback: string) => {
  try {
    const x = getComputedStyle(document.querySelector(".cm-root") || document.body).getPropertyValue(v).trim();
    return x ? `${x}, ${fallback}` : fallback;
  } catch {
    return fallback;
  }
};
export const monoFam = () => familia("--cm-mono", "monospace");
export const serifFam = () => familia("--cm-serif", "Georgia, serif");

const mk = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
};

const tex = (c: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
};

/** Grano de papel (para bumpMap). */
export function papelBump(): THREE.CanvasTexture {
  const { c, g } = mk(256, 256);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  const d = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 70;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  // fibras
  g.globalAlpha = 0.08;
  g.strokeStyle = "#000";
  for (let i = 0; i < 260; i++) {
    g.beginPath();
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18);
    g.stroke();
  }
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

/** Sello de cera: color + relieve. R = radio del sello en unidades de escena. */
export function selloTexturas(letra: string, R: number) {
  const S = 512;
  const dibuja = (g: CanvasRenderingContext2D, modo: "color" | "bump") => {
    const cx = S / 2;
    if (modo === "color") {
      const gr = g.createRadialGradient(cx - 70, cx - 90, 20, cx, cx, S * 0.52);
      gr.addColorStop(0, "#FFC25C");
      gr.addColorStop(0.45, "#F08A1C");
      gr.addColorStop(1, "#B9560A");
      g.fillStyle = gr;
    } else {
      g.fillStyle = "#6a6a6a";
    }
    g.fillRect(0, 0, S, S);
    const rel = modo === "color" ? "rgba(255,226,160,.85)" : "#ffffff";
    const hund = modo === "color" ? "rgba(120,50,0,.55)" : "#1a1a1a";
    // anillos
    g.lineWidth = 7;
    g.strokeStyle = rel;
    g.beginPath();
    g.arc(cx, cx, S * 0.34, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cx, S * 0.305, 0, Math.PI * 2);
    g.stroke();
    // hojas de laurel
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (0.62 + i * 0.075) * (side === 1 ? 1 : -1) + (side === 1 ? 0 : Math.PI);
        const r = S * 0.375;
        const x = cx + Math.cos(a) * r;
        const y = cx + Math.sin(a) * r;
        g.save();
        g.translate(x, y);
        g.rotate(a + Math.PI / 2 + side * 0.45);
        g.fillStyle = rel;
        g.beginPath();
        g.ellipse(0, 0, 9, 22, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    // letra
    g.font = `700 ${S * 0.42}px "Times New Roman", Georgia, serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = hund;
    g.fillText(letra, cx + 4, cx + S * 0.035 + 5);
    g.fillStyle = rel;
    g.fillText(letra, cx, cx + S * 0.035);
  };
  const a = mk(S, S);
  dibuja(a.g, "color");
  const b = mk(S, S);
  dibuja(b.g, "bump");
  const map = tex(a.c);
  const bump = tex(b.c, false);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1 / (2 * R), 1 / (2 * R));
    t.offset.set(0.5, 0.5);
  }
  return { map, bump };
}

/** Carta que sale del sobre. */
export function cartaTextura(titulo: string[], sub: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 640;
  const { c, g } = mk(W, H);
  g.fillStyle = "#FFFDF8";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#F07F13";
  g.lineWidth = 6;
  g.strokeRect(26, 26, W - 52, H - 52);
  g.lineWidth = 2;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.fillStyle = "#F07F13";
  g.font = `500 44px ${monoFam()}`;
  g.textAlign = "center";
  g.fillText("</>", W / 2, 118);
  g.fillStyle = "#2B2118";
  titulo.forEach((l, i) => {
    g.font = `italic 600 ${i === 0 ? 70 : 118}px ${serifFam()}`;
    g.fillText(l, W / 2, 230 + i * 120);
  });
  g.fillStyle = "#7a6a58";
  g.font = `500 30px ${monoFam()}`;
  g.fillText(sub, W / 2, H - 92);
  return tex(c);
}

/** Pantalla del portátil: código que sube sin parar. */
export class PantallaCodigo {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  t: THREE.CanvasTexture;
  lineas: { x: number; partes: [string, number][] }[] = [];
  acc = 0;
  constructor() {
    const { c, g } = mk(512, 330);
    this.c = c;
    this.g = g;
    this.t = tex(c);
    for (let i = 0; i < 16; i++) this.lineas.push(this.nueva());
    this.pinta();
  }
  private nueva() {
    const pal = ["#7DD3FC", "#F9A8D4", "#FDE68A", "#86EFAC", "#C4B5FD", "#FDBA74", "#E5E7EB"];
    const n = 1 + Math.floor(Math.random() * 4);
    const partes: [string, number][] = [];
    for (let i = 0; i < n; i++) partes.push([pal[Math.floor(Math.random() * pal.length)], 20 + Math.random() * 90]);
    return { x: Math.floor(Math.random() * 3) * 18, partes };
  }
  pinta() {
    const g = this.g;
    g.fillStyle = "#0d1117";
    g.fillRect(0, 0, 512, 330);
    g.fillStyle = "#161b22";
    g.fillRect(0, 0, 512, 24);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(16 + i * 18, 12, 5, 0, Math.PI * 2);
      g.fill();
    });
    this.lineas.forEach((l, i) => {
      const y = 44 + i * 18;
      g.fillStyle = "#3b4350";
      g.font = "10px monospace";
      g.fillText(String(i + 1).padStart(2, "0"), 10, y + 8);
      let x = 36 + l.x;
      l.partes.forEach(([col, w]) => {
        g.fillStyle = col;
        g.globalAlpha = 0.9;
        g.fillRect(x, y, w, 9);
        g.globalAlpha = 1;
        x += w + 8;
      });
    });
    this.t.needsUpdate = true;
  }
  tick(dt: number) {
    this.acc += dt;
    if (this.acc > 0.16) {
      this.acc = 0;
      this.lineas.shift();
      this.lineas.push(this.nueva());
      this.pinta();
    }
  }
}

/** Etiqueta de la botella. */
export function etiquetaTextura(letra: string): THREE.CanvasTexture {
  const { c, g } = mk(256, 256);
  g.fillStyle = "#FBF4E4";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#C9751A";
  g.lineWidth = 6;
  g.strokeRect(10, 10, 236, 236);
  g.fillStyle = "#C9751A";
  g.font = '700 150px Georgia, "Times New Roman", serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(letra, 128, 120);
  g.font = `600 22px ${monoFam()}`;
  g.fillText("v3.0", 128, 214);
  return tex(c);
}

/** Glow radial suave (fondo de escena). */
export function glowTextura(): THREE.CanvasTexture {
  const { c, g } = mk(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,168,70,.55)");
  gr.addColorStop(0.5, "rgba(255,190,110,.18)");
  gr.addColorStop(1, "rgba(255,200,130,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

/** Texto suelto como textura (sin cargar fuentes extra ni trabajadores). */
export function glifoTextura(txt: string, color: string, px = 160) {
  const c = document.createElement("canvas");
  const g0 = c.getContext("2d")!;
  g0.font = `700 ${px}px ${monoFam()}`;
  const w = Math.ceil(g0.measureText(txt).width + px * 0.4);
  c.width = w;
  c.height = Math.ceil(px * 1.5);
  const g = c.getContext("2d")!;
  g.font = `700 ${px}px ${monoFam()}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(txt, w / 2, c.height / 2);
  const t = tex(c);
  return { tex: t, aspect: w / c.height };
}
