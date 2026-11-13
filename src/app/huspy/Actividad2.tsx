"use client";

import { useMemo, useState } from "react";
import { PhoneForwarded, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Lightbulb, MousePointerClick } from "lucide-react";
import { GUION_PARTES, type CampoGuion } from "./data";
import s from "./huspy.module.css";

type Pieza = { id: string; campo: CampoGuion; label: string };

// ---- Datos de los dos casos de "completar guion" ----
const CASO1: Pieza[] = [
  { id: "c1-asesor", campo: "asesor", label: "Melania Rawat Molina" },
  { id: "c1-cliente", campo: "cliente", label: "Laura Martínez" },
  { id: "c1-calle", campo: "calle", label: "Calle Málaga 42" },
  { id: "c1-ciudad", campo: "ciudad", label: "Mijas" },
  { id: "c1-precio", campo: "precio", label: "185.000 €" },
  { id: "c1-contexto", campo: "contexto", label: "Quiere agendar una visita." },
];
const CASO3: Pieza[] = [
  { id: "c3-asesor", campo: "asesor", label: "Evelyne De Carlo" },
  { id: "c3-cliente", campo: "cliente", label: "Carlos Rodríguez" },
  { id: "c3-calle", campo: "calle", label: "Calle del Mar 8" },
  { id: "c3-ciudad", campo: "ciudad", label: "Fuengirola, Málaga" },
  { id: "c3-precio", campo: "precio", label: "695.000 €" },
  { id: "c3-contexto", campo: "contexto", label: "Quiere más información sobre el inmueble." },
];

function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- Sub-componente: completar el guion (toca el dato y luego el espacio, o arrastra) ----
function GuionFill({ piezas, titulo, onOk }: { piezas: Pieza[]; titulo: string; onOk: () => void }) {
  const barajadas = useMemo(() => barajar(piezas), [piezas]);
  const [asig, setAsig] = useState<Record<string, string | null>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [validado, setValidado] = useState(false);
  const [over, setOver] = useState<string | null>(null);

  const usados = new Set(Object.values(asig).filter(Boolean) as string[]);
  const piezaDe = (id: string | null) => barajadas.find((p) => p.id === id) ?? null;

  function colocar(campo: CampoGuion, pid: string) {
    setAsig((a) => {
      const next: Record<string, string | null> = { ...a };
      for (const k of Object.keys(next)) if (next[k] === pid) next[k] = null; // mover si estaba en otro slot
      next[campo] = pid;
      return next;
    });
    setSel(null);
    setValidado(false);
  }
  function clickSlot(campo: CampoGuion) {
    if (asig[campo]) { setAsig((a) => ({ ...a, [campo]: null })); setValidado(false); return; }
    if (sel) colocar(campo, sel);
  }

  const correctos = GUION_PARTES.filter((p) => "campo" in p).map((p) => (p as { campo: CampoGuion }).campo);
  const slotOk = (campo: CampoGuion) => asig[campo] === `${piezas[0].id.split("-")[0]}-${campo}`;
  const todoOk = correctos.every((c) => slotOk(c));

  function validar() {
    setValidado(true);
    if (correctos.every((c) => slotOk(c))) setTimeout(onOk, 900);
  }

  return (
    <>
      <p className={s.sectionSub}><MousePointerClick size={14} style={{ verticalAlign: "-2px" }} /> {titulo}</p>

      {/* Piezas disponibles */}
      <div className={s.chips}>
        {barajadas.map((p) => (
          <div
            key={p.id}
            className={`${s.chip} ${usados.has(p.id) ? s.chipUsed : ""} ${sel === p.id ? s.audioSel : ""}`}
            draggable={!usados.has(p.id)}
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", p.id); setSel(p.id); }}
            onClick={() => !usados.has(p.id) && setSel(sel === p.id ? null : p.id)}
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* Guion con espacios */}
      <div className={s.scriptBox}>
        {GUION_PARTES.map((parte, i) => {
          if ("fijo" in parte) return <span key={i}>{parte.fijo}</span>;
          const campo = parte.campo;
          const pid = asig[campo];
          const pieza = piezaDe(pid ?? null);
          const ok = validado && slotOk(campo);
          const bad = validado && pid && !slotOk(campo);
          return (
            <span
              key={i}
              className={`${s.slot} ${over === campo ? s.slotOver : ""} ${pieza ? s.slotFilled : ""} ${ok ? s.slotFilledOk : ""}`}
              style={bad ? { color: "var(--bad)", borderColor: "var(--bad)", background: "var(--bad-soft)" } : undefined}
              onClick={() => clickSlot(campo)}
              onDragOver={(e) => { e.preventDefault(); setOver(campo); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) colocar(campo, id); }}
            >
              {pieza ? pieza.label : `[ ${parte.etiqueta} ]`}
            </span>
          );
        })}
      </div>

      {validado && !todoOk && (
        <div className={`${s.banner} ${s.bannerBad}`}><AlertTriangle size={17} /> Aún hay espacios sin el dato correcto. Revisa los que quedaron en rojo.</div>
      )}
      {validado && todoOk && (
        <div className={`${s.banner} ${s.bannerOk}`}><CheckCircle2 size={17} /> ¡Guion completo y correcto!</div>
      )}

      <div className={s.actions}>
        <button className={`${s.btn} ${s.btnPrimary} ${s.spacer}`} onClick={validar}>Validar guion <ArrowRight size={16} /></button>
      </div>
    </>
  );
}

// ---- Caso 2: detectar la información que falta ----
const FALTANTES = [
  { id: "asesor", label: "Nombre del asesor", correcto: true },
  { id: "cliente", label: "Nombre completo del cliente", correcto: true },
  { id: "propiedad", label: "Propiedad específica", correcto: true },
  { id: "ubicacion", label: "Ubicación", correcto: true },
  { id: "precio", label: "Precio", correcto: true },
  { id: "contexto", label: "Contexto de la necesidad del cliente", correcto: true },
  { id: "edad", label: "Edad del cliente", correcto: false },
  { id: "correo", label: "Correo del cliente", correcto: false },
];

function CasoFaltantes({ onOk }: { onOk: () => void }) {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [validado, setValidado] = useState(false);
  const toggle = (id: string) => { setSel((p) => ({ ...p, [id]: !p[id] })); setValidado(false); };
  const correcto = FALTANTES.every((o) => !!sel[o.id] === o.correcto);

  function validar() {
    setValidado(true);
    if (FALTANTES.every((o) => !!sel[o.id] === o.correcto)) setTimeout(onOk, 900);
  }

  return (
    <>
      <p className={s.sectionSub}>Esta transferencia está incompleta. Marca <b>toda</b> la información que falta (y solo la que falta):</p>
      <div className={s.scriptBox} style={{ fontStyle: "italic", lineHeight: 1.7, marginBottom: 18 }}>
        «Hola, tenemos en línea a Laura. Está interesada en un piso. ¿Te pasamos la llamada?»
      </div>
      <div className={s.checkList}>
        {FALTANTES.map((o) => {
          const on = !!sel[o.id];
          const marca = validado ? (on === o.correcto ? "ok" : "bad") : null;
          return (
            <div key={o.id} className={s.checkItem} onClick={() => toggle(o.id)}
              style={marca === "ok" ? { borderColor: "var(--ok)", background: "var(--ok-soft)" } : marca === "bad" ? { borderColor: "var(--bad)", background: "var(--bad-soft)" } : undefined}>
              <span className={`${s.checkBox} ${on ? s.checkOn : ""}`}>{on && <CheckCircle2 size={15} />}</span>
              {o.label}
            </div>
          );
        })}
      </div>
      {validado && !correcto && <div className={`${s.banner} ${s.bannerBad}`}><AlertTriangle size={17} /> Revisa: faltan datos del protocolo o marcaste alguno que no corresponde.</div>}
      {validado && correcto && <div className={`${s.banner} ${s.bannerOk}`}><CheckCircle2 size={17} /> ¡Exacto! Todo eso debía ir en la transferencia.</div>}
      <div className={s.actions}>
        <button className={`${s.btn} ${s.btnPrimary} ${s.spacer}`} onClick={validar}>Validar <ArrowRight size={16} /></button>
      </div>
    </>
  );
}

export default function Actividad2({ onComplete, onSalir }: { onComplete: (score: number) => void; onSalir: () => void }) {
  const [paso, setPaso] = useState(1);
  const [fallos, setFallos] = useState(0);

  function avanzar() {
    if (paso < 3) setPaso(paso + 1);
    else { const score = Math.max(50, 100 - fallos * 8); onComplete(score); }
  }

  return (
    <div className={s.fadeUp}>
      <div className={s.card}>
        <div className={s.actHead}>
          <div className={s.mNum}><PhoneForwarded size={20} /></div>
          <div>
            <div className={s.actBadge}>Misión 2 · Protocolo de transferencia · Paso {paso} de 3</div>
            <h2 className={s.actTitle}>¡Transfiere correctamente!</h2>
            <p className={s.actObj}>Entrega la llamada al asesor correcto con toda la información, sin que el cliente repita lo que ya explicó.</p>
          </div>
        </div>

        <div className={s.progressWrap}>
          <div className={s.progressTrack}><div className={s.progressFill} style={{ width: `${(paso - 1) / 3 * 100}%` }} /></div>
          <span className={s.progressLabel}>Paso {paso}/3</span>
        </div>

        {paso === 1 && <GuionFill key="c1" piezas={CASO1} titulo="Caso 1 — Laura Martínez. Arrastra (o toca) cada dato a su espacio del guion oficial." onOk={avanzar} />}
        {paso === 2 && <CasoFaltantes onOk={avanzar} />}
        {paso === 3 && <GuionFill key="c3" piezas={CASO3} titulo="Caso 3 — Carlos Rodríguez. Completa el guion oficial con sus datos." onOk={avanzar} />}

        <div className={s.tip}>
          <Lightbulb size={18} style={{ flex: "none" }} />
          <span>Una buena transferencia evita reprocesos y permite que el asesor continúe la atención con el contexto necesario.</span>
        </div>

        <div className={s.actions} style={{ marginTop: 10 }}>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={onSalir}><ArrowLeft size={16} /> Volver al menú</button>
        </div>
      </div>
    </div>
  );
}
