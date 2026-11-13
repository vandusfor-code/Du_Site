"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Save, AlertTriangle, CheckCircle2, ArrowLeft, Lightbulb } from "lucide-react";
import { CATALOGO, ASESORES, fmtPrecio } from "./data";
import s from "./huspy.module.css";

// Caso correcto (lo que DEBE quedar en la ficha).
const CORRECTO = {
  cliente: "Laura Martínez",
  propiedad: "Piso en venta - Mijas",
  asesor: "Melania Rawat Molina",
  ciudad: "Mijas",
};

// Ficha inicial con errores intencionales.
const INICIAL = {
  cliente: "Laura Martín",
  propiedad: "Local en venta - San Sebastián de los Reyes",
  asesor: "Iago García Vaquero",
  ciudad: "Fuengirola",
};

type Campo = keyof typeof CORRECTO;
const norm = (x: string) => x.trim().toLowerCase();

export default function Actividad1({ onComplete, onSalir }: { onComplete: (score: number) => void; onSalir: () => void }) {
  const [f, setF] = useState({ ...INICIAL });
  const [malos, setMalos] = useState<Record<string, boolean>>({});
  const [validado, setValidado] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [listo, setListo] = useState(false);

  const propiedadSel = useMemo(() => CATALOGO.find((p) => p.titulo === f.propiedad) ?? null, [f.propiedad]);

  function set(campo: Campo, val: string) {
    setF((p) => ({ ...p, [campo]: val }));
    setValidado(false);
    setMalos((m) => ({ ...m, [campo]: false }));
  }

  function errores(): Record<string, boolean> {
    return {
      cliente: norm(f.cliente) !== norm(CORRECTO.cliente),
      propiedad: f.propiedad !== CORRECTO.propiedad,
      asesor: f.asesor !== CORRECTO.asesor,
      ciudad: norm(f.ciudad) !== norm(CORRECTO.ciudad),
    };
  }

  function validar() {
    const e = errores();
    setMalos(e);
    setValidado(true);
  }

  function guardar() {
    const e = errores();
    setMalos(e);
    setValidado(true);
    const hayError = Object.values(e).some(Boolean);
    if (hayError) {
      setIntentosFallidos((n) => n + 1);
      return;
    }
    setListo(true);
    const score = Math.max(60, 100 - intentosFallidos * 10);
    setTimeout(() => onComplete(score), 1700);
  }

  if (listo) {
    return (
      <div className={`${s.card} ${s.success} ${s.pop}`}>
        <div className={s.successIcon}><CheckCircle2 size={42} /></div>
        <h2 className={s.successTitle}>¡Lead correctamente creado!</h2>
        <p className={s.successText}>
          Antes de guardar, verifica que el <b>cliente</b>, la <b>propiedad</b> y el <b>asesor</b> correspondan
          a la misma gestión.
        </p>
      </div>
    );
  }

  const campoCls = (c: Campo) => `${s.field} ${validado ? (malos[c] ? s.fieldBad : s.fieldOk) : ""}`;
  const hayAlgunError = validado && Object.values(malos).some(Boolean);

  return (
    <div className={s.fadeUp}>
      <div className={s.card}>
        <div className={s.actHead}>
          <div className={s.mNum}><ShieldCheck size={20} /></div>
          <div>
            <div className={s.actBadge}>Misión 1 · Creación y validación de leads</div>
            <h2 className={s.actTitle}>¡No dañes el lead!</h2>
            <p className={s.actObj}>
              Recibes una llamada de <b>Laura Martínez</b>, interesada en un <b>piso en venta en Mijas</b>.
              La ficha del CRM llegó con errores. Corrígela y valida antes de guardar.
            </p>
          </div>
        </div>

        <div className={s.fieldGrid}>
          <div className={campoCls("cliente")}>
            <label>Nombre del cliente</label>
            <input value={f.cliente} onChange={(e) => set("cliente", e.target.value)} className={validado && malos.cliente ? s.shake : ""} />
            {validado && (malos.cliente
              ? <span className={s.fieldHint}><AlertTriangle size={13} /> Este dato no coincide con la gestión.</span>
              : <span className={s.fieldHintOk}><CheckCircle2 size={13} /> Correcto</span>)}
          </div>

          <div className={campoCls("propiedad")}>
            <label>Propiedad de interés</label>
            <select value={f.propiedad} onChange={(e) => set("propiedad", e.target.value)}>
              {CATALOGO.map((p) => <option key={p.titulo} value={p.titulo}>{p.titulo}</option>)}
            </select>
            {validado && (malos.propiedad
              ? <span className={s.fieldHint}><AlertTriangle size={13} /> No es la propiedad que pidió el cliente.</span>
              : <span className={s.fieldHintOk}><CheckCircle2 size={13} /> Correcto</span>)}
          </div>

          <div className={campoCls("asesor")}>
            <label>Asesor responsable</label>
            <select value={f.asesor} onChange={(e) => set("asesor", e.target.value)}>
              {ASESORES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {validado && (malos.asesor
              ? <span className={s.fieldHint}><AlertTriangle size={13} /> Este asesor no corresponde a esa propiedad.</span>
              : <span className={s.fieldHintOk}><CheckCircle2 size={13} /> Correcto</span>)}
          </div>

          <div className={campoCls("ciudad")}>
            <label>Ciudad / zona</label>
            <input value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={validado && malos.ciudad ? s.shake : ""} />
            {validado && (malos.ciudad
              ? <span className={s.fieldHint}><AlertTriangle size={13} /> La ubicación no corresponde.</span>
              : <span className={s.fieldHintOk}><CheckCircle2 size={13} /> Correcto</span>)}
          </div>

          <div className={s.field}>
            <label>Precio (según la propiedad)</label>
            <input value={propiedadSel ? fmtPrecio(propiedadSel.precio) : "—"} readOnly disabled />
          </div>
          <div className={s.field}>
            <label>Dirección de práctica (ficticia)</label>
            <input value="Calle Málaga 42" readOnly disabled />
          </div>
        </div>

        {hayAlgunError && (
          <div className={`${s.banner} ${s.bannerBad}`}>
            <AlertTriangle size={17} /> No se puede guardar: hay datos marcados en rojo. Corrígelos y vuelve a intentar.
          </div>
        )}
        {validado && !hayAlgunError && (
          <div className={`${s.banner} ${s.bannerOk}`}>
            <CheckCircle2 size={17} /> Todo coincide. Ya puedes guardar el lead.
          </div>
        )}

        <div className={s.tip}>
          <Lightbulb size={18} style={{ flex: "none" }} />
          <span>Regla de oro: el cliente, la propiedad y el asesor deben pertenecer a la <b>misma gestión</b>. Valida siempre antes de guardar.</span>
        </div>

        <div className={s.actions}>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={onSalir}><ArrowLeft size={16} /> Volver al menú</button>
          <button className={`${s.btn} ${s.btnGhost} ${s.spacer}`} onClick={validar}>Validar información</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={guardar}><Save size={16} /> Guardar lead</button>
        </div>
      </div>
    </div>
  );
}
