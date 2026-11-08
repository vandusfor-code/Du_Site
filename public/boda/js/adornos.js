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
    return `<g transform="rotate(${r1(a)})"><ellipse cx="0" cy="${-r}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="rgba(170,140,90,.30)" stroke-width="1"/><path d="M0 ${-r - ry * 0.7}Q${-rx * 0.35} ${-r} 0 ${-r + ry * 0.55}" fill="none" stroke="rgba(160,125,75,.22)" stroke-width="1"/></g>`;
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
