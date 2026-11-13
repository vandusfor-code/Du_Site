"use client";

import { useMemo, useRef, useState } from "react";
import { AudioLines, Play, Pause, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import s from "./huspy.module.css";

type Track = { id: "profesional" | "insegura" | "desmotivada"; label: string; src: string };
const TRACKS: Track[] = [
  { id: "profesional", label: "Audio", src: "/huspy/audio/profesional.mp3" },
  { id: "insegura", label: "Audio", src: "/huspy/audio/insegura.mp3" },
  { id: "desmotivada", label: "Audio", src: "/huspy/audio/desmotivada.mp3" },
];

function barajar<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

function AudioCard({ src, titulo, seleccionado, onSelect }: { src: string; titulo: string; seleccionado: boolean; onSelect?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const el = ref.current; if (!el) return;
    if (playing) { el.pause(); } else { document.querySelectorAll("audio").forEach((a) => a !== el && a.pause()); el.currentTime = 0; el.play(); }
  }
  return (
    <div className={`${s.audioCard} ${seleccionado ? s.audioSel : ""}`} onClick={onSelect}>
      <button className={s.playBtn} onClick={toggle} aria-label="Reproducir">{playing ? <Pause size={20} /> : <Play size={20} />}</button>
      <div>
        <div className={s.audioName}>{titulo}</div>
        <div className={s.audioMeta}>{playing ? "Reproduciendo…" : "Toca para escuchar"}</div>
      </div>
      <div className={`${s.waves} ${playing ? s.wavesOn : ""}`}><i /><i /><i /><i /><i /></div>
      {onSelect && <span className={s.audioPickHint}>{seleccionado ? "✓ Elegido" : "Elegir"}</span>}
      <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
}

// ---- Momento 2: relacionar situación con categoría ----
const CATS = ["Energía y tono de voz", "Seguridad y fluidez", "Ritmo y vocalización"];
const SITUACIONES = [
  { txt: "Un agente responde con voz baja y poca energía.", cat: "Energía y tono de voz" },
  { txt: "Un agente realiza pausas constantes y transmite dudas.", cat: "Seguridad y fluidez" },
  { txt: "Un agente habla demasiado rápido y no permite que el cliente comprenda.", cat: "Ritmo y vocalización" },
];

// ---- Momento 3: elegir cómo lo dirías ----
const OPCIONES = [
  { letra: "A", txt: "«Sí, dime, ¿qué necesitas?».", ok: false },
  { letra: "B", txt: "«Bueno... sí, claro... dime qué propiedad era...».", ok: false },
  { letra: "C", txt: "«¡Hola, muy buenos días! Gracias por comunicarte con Huspy. Te habla Laura. Cuéntame, ¿en qué propiedad estás interesado? Con mucho gusto te ayudo».", ok: true },
];

export default function Actividad3({ onComplete, onSalir }: { onComplete: (score: number) => void; onSalir: () => void }) {
  const [paso, setPaso] = useState(1);
  const [fallos, setFallos] = useState(0);

  // Momento 1
  const tracks = useMemo(() => barajar(TRACKS).map((t, i) => ({ ...t, titulo: `Audio ${String.fromCharCode(65 + i)}` })), []);
  const [elegido, setElegido] = useState<string>("");
  const [val1, setVal1] = useState(false);
  // Momento 2
  const [asg, setAsg] = useState<Record<number, string>>({});
  const [val2, setVal2] = useState(false);
  // Momento 3
  const [op, setOp] = useState<string>("");
  const [val3, setVal3] = useState(false);

  function validar1() {
    setVal1(true);
    if (elegido === "profesional") setTimeout(() => setPaso(2), 900);
    else setFallos((n) => n + 1);
  }
  const m2ok = SITUACIONES.every((sit, i) => asg[i] === sit.cat);
  function validar2() {
    setVal2(true);
    if (m2ok) setTimeout(() => setPaso(3), 900);
    else setFallos((n) => n + 1);
  }
  function validar3() {
    setVal3(true);
    if (op === "C") setTimeout(() => onComplete(Math.max(55, 100 - fallos * 8)), 1100);
    else setFallos((n) => n + 1);
  }

  return (
    <div className={s.fadeUp}>
      <div className={s.card}>
        <div className={s.actHead}>
          <div className={s.mNum}><AudioLines size={20} /></div>
          <div>
            <div className={s.actBadge}>Misión 3 · Comunicación telefónica · Momento {paso} de 3</div>
            <h2 className={s.actTitle}>¡Tu voz transmite confianza!</h2>
            <p className={s.actObj}>Mejora energía, seguridad, claridad y profesionalismo en cada llamada.</p>
          </div>
        </div>

        <div className={s.progressWrap}>
          <div className={s.progressTrack}><div className={s.progressFill} style={{ width: `${(paso - 1) / 3 * 100}%` }} /></div>
          <span className={s.progressLabel}>Momento {paso}/3</span>
        </div>

        {/* MOMENTO 1 — escucha y compara */}
        {paso === 1 && (
          <>
            <p className={s.sectionSub}>Escucha los 3 audios (mismo texto, misma voz) y elige cuál representa la atención esperada en Huspy.</p>
            <div className={s.audioRow}>
              {tracks.map((t) => (
                <AudioCard key={t.id} src={t.src} titulo={t.titulo} seleccionado={elegido === t.id} onSelect={() => { setElegido(t.id); setVal1(false); }} />
              ))}
            </div>
            {val1 && (elegido === "profesional"
              ? <div className={`${s.banner} ${s.bannerOk}`}><CheckCircle2 size={17} /> ¡Correcto! Energía equilibrada, seguridad y buena vocalización.</div>
              : <div className={`${s.banner} ${s.bannerBad}`}><AlertTriangle size={17} /> Ese no es. Escucha de nuevo: busca el tono amable, seguro y con energía equilibrada.</div>)}
            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnPrimary} ${s.spacer}`} onClick={validar1} disabled={!elegido}>Confirmar elección <ArrowRight size={16} /></button>
            </div>
          </>
        )}

        {/* MOMENTO 2 — identifica la mejora */}
        {paso === 2 && (
          <>
            <p className={s.sectionSub}>Relaciona cada situación con el aspecto que debe mejorar.</p>
            <div className={s.optList}>
              {SITUACIONES.map((sit, i) => {
                const marca = val2 ? (asg[i] === sit.cat ? "ok" : "bad") : null;
                return (
                  <div key={i} className={`${s.field}`} style={{ border: `1.5px solid ${marca === "ok" ? "var(--ok)" : marca === "bad" ? "var(--bad)" : "var(--line)"}`, borderRadius: 16, padding: 14, background: marca === "ok" ? "var(--ok-soft)" : marca === "bad" ? "var(--bad-soft)" : "#fff" }}>
                    <label style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{sit.txt}</label>
                    <select value={asg[i] ?? ""} onChange={(e) => { setAsg((a) => ({ ...a, [i]: e.target.value })); setVal2(false); }}>
                      <option value="" disabled>— Elige el aspecto —</option>
                      {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            {val2 && (m2ok
              ? <div className={`${s.banner} ${s.bannerOk}`}><CheckCircle2 size={17} /> ¡Muy bien relacionado!</div>
              : <div className={`${s.banner} ${s.bannerBad}`}><AlertTriangle size={17} /> Revisa las que quedaron en rojo.</div>)}
            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnPrimary} ${s.spacer}`} onClick={validar2} disabled={Object.keys(asg).length < 3}>Validar <ArrowRight size={16} /></button>
            </div>
          </>
        )}

        {/* MOMENTO 3 — elige cómo lo dirías */}
        {paso === 3 && (
          <>
            <p className={s.sectionSub}>Elige la forma más profesional de responder al cliente.</p>
            <div className={s.optList}>
              {OPCIONES.map((o) => {
                const marca = val3 && op === o.letra ? (o.ok ? s.optOk : s.optBad) : (val3 && o.ok ? s.optOk : "");
                return (
                  <button key={o.letra} className={`${s.opt} ${op === o.letra && !val3 ? s.audioSel : ""} ${marca}`} onClick={() => { setOp(o.letra); setVal3(false); }}>
                    <span className={s.optLetter}>{o.letra}.</span>{o.txt}
                  </button>
                );
              })}
            </div>
            {val3 && op === "C" && (
              <>
                <div className={`${s.banner} ${s.bannerOk}`}><CheckCircle2 size={17} /> ¡Esa es! Escucha el audio de referencia:</div>
                <div style={{ marginTop: 12 }}><AudioCard src="/huspy/audio/profesional.mp3" titulo="Audio de referencia (profesional)" seleccionado={false} /></div>
              </>
            )}
            {val3 && op !== "C" && op !== "" && <div className={`${s.banner} ${s.bannerBad}`}><AlertTriangle size={17} /> Esa no transmite seguridad. Vuelve a elegir.</div>}
            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnPrimary} ${s.spacer}`} onClick={validar3} disabled={!op}>Confirmar <ArrowRight size={16} /></button>
            </div>
          </>
        )}

        <div className={s.tip}>
          <Lightbulb size={18} style={{ flex: "none" }} />
          <span>Una buena atención no depende solo de lo que decimos, sino de cómo lo transmitimos: seguridad, claridad, amabilidad y disposición.</span>
        </div>
        <div className={s.actions} style={{ marginTop: 10 }}>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={onSalir}><ArrowLeft size={16} /> Volver al menú</button>
        </div>
      </div>
    </div>
  );
}
