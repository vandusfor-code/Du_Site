// Adornos vectoriales del tema "blanco y dorado": flores, ramitas, lazo, sello, medallón y borla.
// Todo se dibuja con SVG propio (sin imágenes externas).

/* Degradados compartidos (se insertan una sola vez dentro de la invitación) */
export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="gOro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3E2B0"/><stop offset=".4" stop-color="#CBA85E"/><stop offset=".75" stop-color="#A57F35"/><stop offset="1" stop-color="#E8D49A"/></linearGradient>
  <linearGradient id="gOroV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBD9A2"/><stop offset=".5" stop-color="#C9A55C"/><stop offset="1" stop-color="#9C7A34"/></linearGradient>
  <radialGradient id="rOro" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#F7E8B8"/><stop offset=".45" stop-color="#D2B068"/><stop offset="1" stop-color="#8F6D2B"/></radialGradient>
  <radialGradient id="pMarfil" cx=".5" cy=".85" r="1"><stop offset="0" stop-color="#EBDACB"/><stop offset=".55" stop-color="#FAF4EC"/><stop offset="1" stop-color="#FFFFFF"/></radialGradient>
  <radialGradient id="pMarfil2" cx=".5" cy=".9" r="1"><stop offset="0" stop-color="#E4CDBB"/><stop offset=".6" stop-color="#F8EFE6"/><stop offset="1" stop-color="#FFFFFF"/></radialGradient>
  <radialGradient id="pBlush" cx=".5" cy=".85" r="1"><stop offset="0" stop-color="#E9BFB8"/><stop offset=".55" stop-color="#F8E2DD"/><stop offset="1" stop-color="#FFF6F3"/></radialGradient>
  <linearGradient id="gHoja" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7F9373"/><stop offset="1" stop-color="#B6C4A6"/></linearGradient>
  <linearGradient id="gSatin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#F6EEE2"/><stop offset="1" stop-color="#E7D8C2"/></linearGradient>
  <linearGradient id="gSatin2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#F3E9DA"/><stop offset="1" stop-color="#DCCBB2"/></linearGradient>
</defs></svg>`;

const r1 = n => Math.round(n * 10) / 10;

/* Peonía / rosa de pétalos en capas */
export function peonia(tono = "marfil", id = 1) {
  const f1 = tono === "blush" ? "url(#pBlush)" : "url(#pMarfil)";
  const f2 = tono === "blush" ? "url(#pBlush)" : "url(#pMarfil2)";
  const ring = (n, r, rx, ry, rot, fill) => Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 360) / n;
    return `<g transform="rotate(${r1(a)})"><ellipse cx="0" cy="${-r}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="rgba(170,140,90,.16)" stroke-width=".7"/><path d="M0 ${-r - ry * 0.7}Q${-rx * 0.35} ${-r} 0 ${-r + ry * 0.55}" fill="none" stroke="rgba(160,125,75,.12)" stroke-width=".8"/></g>`;
  }).join("");
  const est = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, d = 7 + (i % 3) * 2.5; return `<circle cx="${r1(Math.cos(a) * d)}" cy="${r1(Math.sin(a) * d)}" r="1.7" fill="#C9A55C"/>`; }).join("");
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true">
    <g>${ring(9, 54, 32, 40, id * 11, f1)}${ring(8, 38, 27, 34, 20 + id * 7, f2)}${ring(6, 23, 21, 27, 10 + id * 5, f1)}${ring(5, 11, 14, 17, 30, f2)}
    <circle r="9" fill="#E8D49A" opacity=".9"/>${est}<circle r="3.4" fill="#A57F35"/></g></svg>`;
}

/* Hoja suave (verde salvia) */
const hoja = (x, y, rot, s = 1, op = 1) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity="${op}"><path d="M0 0C10-15 40-17 64 0C40 17 10 15 0 0Z" fill="url(#gHoja)"/><path d="M2 0L58 0" stroke="rgba(255,255,255,.55)" stroke-width="1.2" fill="none"/></g>`;

/* Ramita dorada de línea (como la del monograma) */
export function ramaOro(n = 7, s = 1) {
  let hojas = "";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = 12 + t * 150, y = 62 - Math.sin(t * 2.1) * 34, lado = i % 2 ? 1 : -1;
    hojas += `<path d="M${r1(x)} ${r1(y)}q${lado * 14} ${-lado * 20} ${lado * 34} ${-lado * 12}q${-lado * 6} ${lado * 20} ${-lado * 34} ${lado * 12}z" fill="none" stroke="url(#gOro)" stroke-width="1.4" stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 190 110" style="transform:scale(${s})" aria-hidden="true"><path d="M4 70C50 70 100 50 170 24" fill="none" stroke="url(#gOro)" stroke-width="1.6" stroke-linecap="round"/>${hojas}</svg>`;
}

/* Ramillete: flor grande + flores pequeñas + hojas y ramitas doradas (para las esquinas) */
export function ramillete(variante = 0) {
  const polar = (a, r) => [r1(150 + Math.cos((a * Math.PI) / 180) * r), r1(150 + Math.sin((a * Math.PI) / 180) * r)];
  const hojas = [[-30, 1.45], [8, 1.35], [48, 1.4], [92, 1.3], [138, 1.45], [182, 1.4], [228, 1.35], [262, 1.3], [300, 1.4]]
    .map(([a, sc]) => { const [x, y] = polar(a, 58); return hoja(x, y, a, sc, 0.96); }).join("");
  const ramas = [[200, 56], [320, 40]].map(([a, sc], i) => { const [x, y] = polar(a, 70); return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${(sc / 60) * 1.4})">${ramaOro(6).replace(/<svg[^>]*>/, "<g>").replace("</svg>", "</g>")}</g>`; }).join("");
  const flores = [[150, 150, 1.0, "marfil"], [66, 226, 0.6, "blush"], [236, 76, 0.62, "marfil"], [60, 82, 0.4, "marfil"], [244, 226, 0.46, "blush"]]
    .map(([x, y, sc, t], i) => `<g transform="translate(${x} ${y}) scale(${sc})">${peonia(t, i + variante).replace(/<svg[^>]*>/, "<g>").replace("</svg>", "</g>")}</g>`).join("");
  const g = variante === 1 ? "scale(-1 1) translate(-300 0)" : variante === 2 ? "rotate(90 150 150)" : "";
  return `<svg viewBox="0 0 300 300" aria-hidden="true"><g transform="${g}">${ramas}${hojas}${flores}</g></svg>`;
}

/* Lazo de satín marfil con bordes dorados */
export function lazo() {
  return `<svg viewBox="0 0 320 250" aria-hidden="true">
    <g class="lz-cola izq"><path d="M148 122C134 160 114 206 92 240L124 222L138 246C148 206 158 164 166 126Z" fill="url(#gSatin2)" stroke="#C9A55C" stroke-width="1.6" stroke-linejoin="round"/></g>
    <g class="lz-cola der"><path d="M172 122C186 160 206 206 228 240L196 222L182 246C172 206 162 164 154 126Z" fill="url(#gSatin)" stroke="#C9A55C" stroke-width="1.6" stroke-linejoin="round"/></g>
    <g class="lz-asa izq"><path d="M160 112C112 36 24 24 14 88C8 142 96 164 160 124Z" fill="url(#gSatin2)" stroke="#C9A55C" stroke-width="1.8" stroke-linejoin="round"/><path d="M158 112C112 82 64 78 36 96M156 120C112 128 64 126 30 104" fill="none" stroke="rgba(201,165,92,.55)" stroke-width="1.2"/></g>
    <g class="lz-asa der"><path d="M160 112C208 36 296 24 306 88C312 142 224 164 160 124Z" fill="url(#gSatin)" stroke="#C9A55C" stroke-width="1.8" stroke-linejoin="round"/><path d="M162 112C208 82 256 78 284 96M164 120C208 128 256 126 290 104" fill="none" stroke="rgba(201,165,92,.55)" stroke-width="1.2"/></g>
    <rect x="136" y="92" width="48" height="46" rx="15" fill="url(#gSatin)" stroke="#C9A55C" stroke-width="1.8"/><path d="M146 104C156 100 166 100 176 104" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".9"/>
  </svg>`;
}

/* Sello de lacre dorado con flor en relieve */
export function sello(id = 1) {
  const pts = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2, r = 46 + ((i * 7 + id * 3) % 5) * 1.3 + (i % 2 ? 2.2 : 0); return [r1(Math.cos(a) * r), r1(Math.sin(a) * r)]; });
  const d = "M" + pts.map(p => p.join(" ")).join("L") + "Z";
  const pet = Array.from({ length: 6 }, (_, i) => `<ellipse cx="0" cy="-17" rx="8.5" ry="15" transform="rotate(${i * 60})" fill="none" stroke="rgba(255,244,205,.85)" stroke-width="1.6"/><ellipse cx="0" cy="-17" rx="8.5" ry="15" transform="rotate(${i * 60 + 2}) translate(1.5 1.5)" fill="none" stroke="rgba(110,80,25,.45)" stroke-width="1"/>`).join("");
  return `<svg viewBox="-60 -60 120 120" aria-hidden="true"><path d="${d}" fill="url(#rOro)" stroke="rgba(120,90,30,.5)" stroke-width="1.2"/><circle r="36" fill="none" stroke="rgba(255,244,205,.8)" stroke-width="2"/><circle r="33" fill="none" stroke="rgba(110,80,25,.4)" stroke-width="1"/>${pet}<circle r="5" fill="rgba(255,244,205,.9)"/></svg>`;
}

/* Medallón dorado con esquinas cóncavas (para títulos tipo etiqueta) */
export function cartucho() {
  return `<svg viewBox="0 0 250 150" preserveAspectRatio="none" aria-hidden="true">
    <path d="M30 2H220A28 28 0 0 0 248 30V120A28 28 0 0 0 220 148H30A28 28 0 0 0 2 120V30A28 28 0 0 0 30 2Z" fill="#FBF7F0" stroke="url(#gOro)" stroke-width="2.4"/>
    <path d="M34 12H216A22 22 0 0 0 238 34V116A22 22 0 0 0 216 138H34A22 22 0 0 0 12 116V34A22 22 0 0 0 34 12Z" fill="none" stroke="url(#gOro)" stroke-width="1"/>
    <path d="M125 2l6 6-6 6-6-6z M125 136l6 6-6 6-6-6z" fill="url(#gOro)"/>
  </svg>`;
}

/* Borla dorada */
export function borla() {
  const hebras = Array.from({ length: 13 }, (_, i) => `<path d="M${24 + i * 1.8} 52Q${14 + i * 2.6} 84 ${10 + i * 3.4} 118" fill="none" stroke="url(#gOroV)" stroke-width="2.2" stroke-linecap="round"/>`).join("");
  return `<svg viewBox="0 0 60 130" aria-hidden="true"><path d="M30 0V30" stroke="url(#gOroV)" stroke-width="2"/><circle cx="30" cy="36" r="7" fill="url(#rOro)"/><path d="M24 44H38L40 56H22Z" fill="url(#gOroV)"/>${hebras}</svg>`;
}

/* Corazón del calendario / detalles pequeños */
export const iconoPersonas = `<svg viewBox="0 0 48 32" fill="none" stroke="url(#gOro)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="24" cy="9" r="5.500"/><path d="M13 29c0-7 4.500-11 11-11s11 4 11 11"/><circle cx="10" cy="13" r="4"/><path d="M2 28c0-5 3-8 8-8"/><circle cx="38" cy="13" r="4"/><path d="M46 28c0-5-3-8-8-8"/></svg>`;
export const iconoRegalo = `<svg viewBox="0 0 40 40" fill="none" stroke="url(#gOro)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="15" width="30" height="20" rx="2"/><rect x="3" y="10" width="34" height="6" rx="1.500"/><path d="M20 10V35M20 10C14 2 8 4 11 8s9 2 9 2zM20 10c6-8 12-6 9-2s-9 2-9 2z"/></svg>`;
export const iconoNota = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.600A4 4 0 1 0 14 17V7h4V3z"/></svg>`;

/* =====================================================================
   REALISMO: papel con relieve (arabescos) y lazo de satín
   ===================================================================== */
const sd = n => { let a = n * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; };

/* Tubo de grosor variable alrededor de una curva (para tallos que se afinan) */
function tubo(pts, w0, w1) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, n - 1)], o = pts[Math.max(i - 1, 0)];
    let dx = q[0] - o[0], dy = q[1] - o[1]; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, t = i / (n - 1), w = (w0 + (w1 - w0) * Math.pow(t, 0.7)) / 2;
    L.push([p[0] + nx * w, p[1] + ny * w]); R.push([p[0] - nx * w, p[1] - ny * w]);
  }
  const f = p => `${r1(p[0])} ${r1(p[1])}`;
  return "M" + L.map(f).join("L") + "L" + R.reverse().map(f).join("L") + "Z";
}
/* Curva que se enrosca: la curvatura aumenta hacia la punta */
function voluta(x, y, ang, largo, c0, c1, dir) {
  const N = 90, ds = largo / N, pts = [[x, y]];
  let a = ang, px = x, py = y;
  for (let i = 0; i < N; i++) { const t = i / N; a += dir * (c0 + c1 * Math.pow(t, 2.4)) * ds; px += Math.cos(a) * ds; py += Math.sin(a) * ds; pts.push([px, py]); }
  return pts;
}
/* Hoja de acanto estilizada */
function hojaAcanto(x, y, ang, len, wid, flip = 1) {
  const d = `M0 0C${r1(len * .18)} ${r1(-wid * .9 * flip)} ${r1(len * .62)} ${r1(-wid * 1.05 * flip)} ${r1(len)} ${r1(-wid * .1 * flip)}C${r1(len * .72)} ${r1(wid * .32 * flip)} ${r1(len * .46)} ${r1(wid * .5 * flip)} ${r1(len * .3)} ${r1(wid * .34 * flip)}C${r1(len * .2)} ${r1(wid * .22 * flip)} ${r1(len * .08)} ${r1(wid * .12 * flip)} 0 0Z`;
  return `<path transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})" d="${d}"/>`;
}

/* Tallo = curva de Bézier que termina en espiral (rizo) */
function bez(p0, c1, c2, p1, n = 46) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p1[0], u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p1[1]]); }
  return pts;
}
function rizo(pts, r0, dir, k = 0.15, giro = 2.9 * Math.PI) {
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  let tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
  const th0 = dir > 0 ? Math.atan2(-tx, ty) : Math.atan2(tx, -ty);
  const cx = b[0] - r0 * Math.cos(th0), cy = b[1] - r0 * Math.sin(th0), out = pts.slice();
  for (let i = 1; i <= 60; i++) { const t = (i / 60) * giro, r = r0 * Math.exp(-k * t), th = th0 + dir * t; out.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
  return out;
}

/* Hoja de acanto de tres lóbulos */
function hojaFan(x, y, ang, len, flip = 1) {
  return hojaAcanto(x, y, ang - flip * 26, len * 0.78, len * 0.36, flip) + hojaAcanto(x, y, ang, len, len * 0.42, flip) + hojaAcanto(x, y, ang + flip * 24, len * 0.7, len * 0.34, flip);
}

/* Un conjunto de arabescos (origen arriba-izquierda, ~190×330) */
export function floritura(semilla = 1) {
  const R = sd(semilla), out = [];
  const j = (v, a = 6) => v + (R() - 0.5) * a;
  const en = (tallo, t) => { const i = Math.min(tallo.length - 2, Math.floor(t * (tallo.length - 1))); const p = tallo[i], q = tallo[i + 1]; return [p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0])]; };
  const hojas = (tallo, lista) => lista.forEach(([t, lado, len]) => { const [x, y, a] = en(tallo, t); out.push(hojaFan(x, y, a * 180 / Math.PI + lado * (44 + R() * 10), len * 1.05, lado)); });
  // S1: sale de la esquina, arquea hacia el centro y se enrosca
  const S1 = rizo(bez([4, 8], [j(70), j(2)], [j(138), j(36)], [j(138), j(112)]), 36, 1);
  out.push(`<path d="${tubo(S1, 20, 3)}"/>`);
  hojas(S1, [[0.10, 1, 54], [0.20, -1, 64], [0.32, 1, 60], [0.42, -1, 50]]);
  // S2: baja por el borde izquierdo y se enrosca hacia afuera
  const S2 = rizo(bez([6, 34], [j(30), j(104)], [j(14), j(186)], [j(66), j(248)]), 38, -1);
  out.push(`<path d="${tubo(S2, 19, 3)}"/>`);
  hojas(S2, [[0.10, -1, 56], [0.22, 1, 66], [0.34, -1, 62], [0.46, 1, 54], [0.56, -1, 44]]);
  // ramas finas
  [[S2, 0.30, 1, [58, 40], 16], [S1, 0.28, -1, [34, 70], 14]].forEach(([t0, t, d, off, rr]) => {
    const [x, y, a] = en(t0, t);
    const p1 = [x + off[0] * (d > 0 ? 1 : 1), y + off[1]];
    const r = rizo(bez([x, y], [x + off[0] * 0.2, y + off[1] * 0.6], [p1[0] - off[0] * 0.2, p1[1] - off[1] * 0.1], p1, 20), rr + 10, -d, 0.2);
    out.push(`<path d="${tubo(r, 8, 1.8)}"/>`);
    const [hx, hy, ha] = en(r, 0.35); out.push(hojaAcanto(hx, hy, ha * 180 / Math.PI + d * 40, 34, 16, d));
  });
  // zarcillos finos
  [[S1, 0.55, 1], [S2, 0.62, -1], [S2, 0.80, 1]].forEach(([t0, t, d]) => {
    const [x, y, a] = en(t0, t);
    const p1 = [x + d * 38 + (R() - .5) * 10, y + 34];
    const z = rizo(bez([x, y], [x + d * 14, y + 6], [p1[0] - d * 10, p1[1] - 12], p1, 18), 13, -d, 0.17, 2.6 * Math.PI);
    out.push(`<path d="${tubo(z, 4.4, 1.1)}"/>`);
  });
  return out.join("");
}

/* Definiciones de iluminación (relieve en papel + sombras) */
export const DEFS_REAL = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <filter id="relieve" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/>
    <feDiffuseLighting in="b" surfaceScale="2.2" diffuseConstant="1.27" lighting-color="#EDE3CD" result="d"><feDistantLight azimuth="228" elevation="52"/></feDiffuseLighting>
    <feSpecularLighting in="b" surfaceScale="2.4" specularConstant=".30" specularExponent="14" lighting-color="#FFFFFF" result="s"><feDistantLight azimuth="228" elevation="46"/></feSpecularLighting>
    <feComposite in="d" in2="SourceAlpha" operator="in" result="cuerpo"/>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="brillo"/>
    <feOffset in="SourceAlpha" dx="1.6" dy="2.2" result="of"/><feGaussianBlur in="of" stdDeviation="1.6" result="sb"/>
    <feFlood flood-color="#7A5F30" flood-opacity=".15"/><feComposite in2="sb" operator="in" result="sombra"/>
    <feMerge><feMergeNode in="sombra"/><feMergeNode in="cuerpo"/><feMergeNode in="brillo"/></feMerge>
  </filter>
  <filter id="sombraLazo" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dx="5" dy="14"/><feComponentTransfer><feFuncA type="linear" slope=".38"/></feComponentTransfer></filter>
  <filter id="satin" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".004 .03" numOctaves="2" seed="7" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -.1" result="bump"/>
    <feDiffuseLighting in="bump" surfaceScale="0.9" diffuseConstant="1.08" lighting-color="#FFFFFF" result="l"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
    <feComposite in="l" in2="SourceAlpha" operator="in" result="lc"/>
    <feBlend in="SourceGraphic" in2="lc" mode="multiply"/>
  </filter>
  <linearGradient id="sa1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFEFB"/><stop offset=".35" stop-color="#F7F0E2"/><stop offset=".62" stop-color="#FFFDF8"/><stop offset="1" stop-color="#E4D7BF"/></linearGradient>
  <radialGradient id="saInt" cx=".55" cy=".45" r=".7"><stop offset="0" stop-color="#F3EBDA"/><stop offset=".7" stop-color="#E4D7BE"/><stop offset="1" stop-color="#CDBD9E"/></radialGradient>
  <linearGradient id="saCola" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#DCCFB6"/><stop offset=".22" stop-color="#F6EEDF"/><stop offset=".5" stop-color="#FFFEFA"/><stop offset=".78" stop-color="#F1E8D6"/><stop offset="1" stop-color="#D3C4A6"/></linearGradient>
</defs></svg>`;

/* Lazo de satín grande (viewBox 0 0 440 420): dos ojales hacia arriba, nudo y dos colas */
export function lazoSatin() {
  const ojal = `
    <path d="M214 156C170 70 84 14 26 46C-20 72 -14 148 34 178C92 214 176 196 214 168Z" fill="url(#sa1)"/>
    <path d="M214 156C174 96 112 66 66 84C36 98 38 142 70 158C116 182 176 172 214 164Z" fill="url(#saInt)"/>
    <path d="M214 166C170 156 116 150 58 134" fill="none" stroke="rgba(130,105,62,.22)" stroke-width="2" stroke-linecap="round"/>
    <path d="M200 150C150 66 86 34 40 56" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>
    <path d="M214 168C168 196 92 204 36 176" fill="none" stroke="rgba(110,86,48,.38)" stroke-width="3" stroke-linecap="round"/>`;
  const cola = `
    <path d="M194 176C176 240 146 312 96 396L170 404L198 360C212 312 226 250 238 184Z" fill="url(#saCola)"/>
    <path d="M194 176C190 204 184 224 176 246L216 240C224 220 232 200 238 184Z" fill="rgba(110,86,48,.26)"/>
    <path d="M96 396L170 404L198 360" fill="none" stroke="rgba(110,86,48,.45)" stroke-width="1.8"/>
    <path d="M222 196C214 240 200 290 176 342" fill="none" stroke="rgba(110,86,48,.14)" stroke-width="2.2" stroke-linecap="round"/>`;
  const todo = `<g transform="rotate(-9 214 160)">${ojal}</g><g transform="translate(440 0) scale(-1 1) rotate(-9 214 160)">${ojal}</g>
    <g transform="rotate(-2 220 176)">${cola}</g><g transform="translate(440 0) scale(-1 1) rotate(3 220 176) translate(0 -3)">${cola}</g>`;
  const nudo = `<path d="M186 126C200 116 240 116 254 126C262 146 260 168 252 182C236 192 204 192 188 182C180 164 178 144 186 126Z" fill="url(#sa1)"/>
    <path d="M196 130C206 140 206 164 198 180M210 124C218 142 218 166 212 188M224 124C230 142 232 166 226 190M238 126C244 142 244 164 240 184" fill="none" stroke="rgba(120,96,56,.2)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M192 130C206 122 236 122 248 130" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
  const sombra = (todo + nudo).replace(/fill="[^"]*"/g, 'fill="#000"').replace(/stroke="[^"]*"/g, 'stroke="none"');
  return `<svg viewBox="0 0 440 420" aria-hidden="true" style="overflow:visible">
    <g filter="url(#sombraLazo)" opacity=".85">${sombra}</g>
    <g filter="url(#satin)">${todo}${nudo}</g></svg>`;
}
