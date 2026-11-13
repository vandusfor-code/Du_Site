"use client";

import { useState } from "react";
import { Workflow, Phone, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, PhoneForwarded, Lightbulb } from "lucide-react";
import { CATALOGO, ASESORES, fmtPrecio } from "./data";
import s from "./huspy.module.css";

// Caso correcto
const C = {
  cliente: "Andrea Torres",
  telefono: "+34600000001",
  propiedad: "Local en venta - San Sebastián de los Reyes",
  asesor: "Iago García Vaquero",
  calle: "Avenida de España 12",
  ciudad: "San Sebastián de los Reyes",
  precio: "331.000 €",
  contexto: "Quiere más información sobre el inmueble.",
};

const BIENVENIDAS = [
  { letra: "A", txt: "«¿Aló? ¿Quién habla?»", ok: false },
  { letra: "B", txt: "«Huspy, espere en línea.»", ok: false },
  { letra: "C", txt: "«¡Hola, muy buenos días! Gracias por comunicarte con Huspy, te habla Laura. ¿Con quién tengo el gusto?»", ok: true },
];

export default function Actividad4({ onComplete, onSalir }: { onComplete: (score: number) => void; onSalir: () => void }) {
  const [paso, setPaso] = useState(1);
  const [fallos, setFallos] = useState(0);
  const [msg, setMsg] = useState<{ tipo: "ok" | "bad"; txt: string } | null>(null);

  // estados por paso
  const [bienvenida, setBienvenida] = useState("");
  const [p2cliente, setP2cliente] = useState("");
  const [p2prop, setP2prop] = useState("");
  const [p3prop, setP3prop] = useState("");
  const [lead, setLead] = useState({ nombre: "", telefono: "", propiedad: "", asesor: "" });
  const [guion, setGuion] = useState({ cliente: "", calle: "", ciudad: "", precio: "", asesor: "", contexto: "" });

  function fallar(txt: string) { setMsg({ tipo: "bad", txt }); setFallos((n) => n + 1); }
  function pasar(txt: string) { setMsg({ tipo: "ok", txt }); setTimeout(() => { setMsg(null); setPaso((p) => p + 1); }, 1000); }

  function validarPaso() {
    if (paso === 1) return bienvenida === "C" ? pasar("¡Bienvenida profesional! Buen inicio.") : fallar("Esa bienvenida no es profesional. Saluda, identifícate y pregunta con quién hablas.");
    if (paso === 2) {
      if (p2cliente !== C.cliente) return fallar("Revisa el nombre del cliente que mencionó la llamada.");
      if (p2prop !== C.propiedad) return fallar("Revisa qué propiedad dijo que le interesa.");
      return pasar("¡Correcto! Identificaste al cliente y su interés.");
    }
    if (paso === 3) return p3prop === C.propiedad ? pasar("¡Esa es la propiedad correcta del catálogo!") : fallar("Esa no es. Selecciona exactamente la propiedad que pidió el cliente.");
    if (paso === 4) {
      if (lead.nombre.trim().toLowerCase() !== C.cliente.toLowerCase()) return fallar("El nombre del cliente no coincide.");
      if (lead.telefono.replace(/\s/g, "") !== C.telefono) return fallar("El teléfono no coincide con el de la llamada.");
      if (lead.propiedad !== C.propiedad) return fallar("La propiedad del lead no es la correcta.");
      if (lead.asesor !== C.asesor) return fallar("Ese asesor no corresponde a esta propiedad.");
      return pasar("¡Lead creado con los datos correctos!");
    }
    if (paso === 5) return pasar("¡Datos validados! Preparemos la transferencia.");
    if (paso === 6) {
      const ok = guion.cliente === C.cliente && guion.calle === C.calle && guion.ciudad === C.ciudad && guion.precio === C.precio && guion.asesor === C.asesor && guion.contexto === C.contexto;
      return ok ? pasar("¡Guion completo y correcto!") : fallar("Falta completar bien el guion. Revisa los datos seleccionados.");
    }
    if (paso === 7) return onComplete(Math.max(55, 100 - fallos * 6));
  }

  const opt = (v: string, set: (x: string) => void, arr: string[], ph: string) => (
    <select value={v} onChange={(e) => { set(e.target.value); setMsg(null); }}>
      <option value="" disabled>{ph}</option>
      {arr.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
  );

  return (
    <div className={s.fadeUp}>
      <div className={s.card}>
        <div className={s.actHead}>
          <div className={s.mNum}><Workflow size={20} /></div>
          <div>
            <div className={s.actBadge}>Misión 4 · Simulación integral · Paso {paso} de 7</div>
            <h2 className={s.actTitle}>Eres responsable de toda la gestión</h2>
            <p className={s.actObj}>Aplica todo: de recibir la llamada a transferir al asesor. Si hay un error, corrígelo antes de avanzar.</p>
          </div>
        </div>

        <div className={s.progressWrap}>
          <div className={s.progressTrack}><div className={s.progressFill} style={{ width: `${(paso - 1) / 7 * 100}%` }} /></div>
          <span className={s.progressLabel}>Paso {paso}/7</span>
        </div>

        {/* PASO 1 */}
        {paso === 1 && (
          <>
            <div className={s.phone}>
              <div className={s.ring}><Phone size={34} /></div>
              <div className={s.caller}>Llamada entrante</div>
              <div className={s.callerSub}>+34 600 000 001 · cliente nuevo</div>
            </div>
            <p className={s.sectionSub} style={{ textAlign: "center" }}>Contesta. Elige la bienvenida profesional:</p>
            <div className={s.optList}>
              {BIENVENIDAS.map((b) => (
                <button key={b.letra} className={`${s.opt} ${bienvenida === b.letra ? s.audioSel : ""}`} onClick={() => { setBienvenida(b.letra); setMsg(null); }}>
                  <span className={s.optLetter}>{b.letra}.</span>{b.txt}
                </button>
              ))}
            </div>
          </>
        )}

        {/* PASO 2 */}
        {paso === 2 && (
          <>
            <div className={s.scriptBox} style={{ fontStyle: "italic", marginBottom: 16 }}>
              «Hola, soy <b>Andrea Torres</b>. Vi publicado un <b>local en San Sebastián de los Reyes</b> y quiero más información sobre el inmueble.»
            </div>
            <p className={s.sectionSub}>Identifica la necesidad:</p>
            <div className={s.fieldGrid}>
              <div className={s.field}><label>Nombre del cliente</label>{opt(p2cliente, setP2cliente, ["Andrea Torres", "Andrea Flores", "Andrés Torres"], "— Elige —")}</div>
              <div className={s.field}><label>Propiedad de interés</label>{opt(p2prop, setP2prop, CATALOGO.map((p) => p.titulo), "— Elige —")}</div>
            </div>
          </>
        )}

        {/* PASO 3 */}
        {paso === 3 && (
          <>
            <p className={s.sectionSub}>Selecciona en el catálogo la propiedad correcta:</p>
            <div className={s.field}>
              <label>Catálogo de propiedades</label>
              <select value={p3prop} onChange={(e) => { setP3prop(e.target.value); setMsg(null); }}>
                <option value="" disabled>— Selecciona —</option>
                {CATALOGO.map((p) => <option key={p.titulo} value={p.titulo}>{p.titulo} — {fmtPrecio(p.precio)}</option>)}
              </select>
            </div>
          </>
        )}

        {/* PASO 4 */}
        {paso === 4 && (
          <>
            <p className={s.sectionSub}>Crea el lead con los datos de la llamada:</p>
            <div className={s.fieldGrid}>
              <div className={s.field}><label>Nombre del cliente</label><input value={lead.nombre} onChange={(e) => { setLead({ ...lead, nombre: e.target.value }); setMsg(null); }} placeholder="Nombre y apellido" /></div>
              <div className={s.field}><label>Teléfono</label><input value={lead.telefono} onChange={(e) => { setLead({ ...lead, telefono: e.target.value }); setMsg(null); }} placeholder="+34 …" /></div>
              <div className={s.field}><label>Propiedad</label>{opt(lead.propiedad, (x) => setLead({ ...lead, propiedad: x }), CATALOGO.map((p) => p.titulo), "— Elige —")}</div>
              <div className={s.field}><label>Asesor responsable</label>{opt(lead.asesor, (x) => setLead({ ...lead, asesor: x }), ASESORES, "— Elige —")}</div>
            </div>
          </>
        )}

        {/* PASO 5 */}
        {paso === 5 && (
          <>
            <p className={s.sectionSub}>Valida que todo coincida antes de transferir:</p>
            <div className={s.summary}>
              <div className={s.sumRow}><span>Cliente</span><b>{lead.nombre || "—"}</b></div>
              <div className={s.sumRow}><span>Teléfono</span><b>{lead.telefono || "—"}</b></div>
              <div className={s.sumRow}><span>Propiedad</span><b>{lead.propiedad || "—"}</b></div>
              <div className={s.sumRow}><span>Asesor</span><b>{lead.asesor || "—"}</b></div>
              <div className={s.sumRow}><span>Precio</span><b>{C.precio}</b></div>
              <div className={s.sumRow}><span>Contexto</span><b>{C.contexto}</b></div>
            </div>
          </>
        )}

        {/* PASO 6 */}
        {paso === 6 && (
          <>
            <p className={s.sectionSub}>Completa el guion oficial de Huspy con la información correcta:</p>
            <div className={s.scriptBox} style={{ lineHeight: 2.2 }}>
              Hola, {opt(guion.asesor, (x) => setGuion({ ...guion, asesor: x }), ASESORES, "asesor")}, te saludamos del call center de Huspy. Tenemos en línea a {opt(guion.cliente, (x) => setGuion({ ...guion, cliente: x }), ["Andrea Torres", "Andrea Flores", "Carlos Rodríguez"], "cliente")}, que está interesado en tu propiedad de {opt(guion.calle, (x) => setGuion({ ...guion, calle: x }), ["Avenida de España 12", "Calle del Mar 8", "Calle Málaga 42"], "calle")}, en {opt(guion.ciudad, (x) => setGuion({ ...guion, ciudad: x }), ["San Sebastián de los Reyes", "Fuengirola, Málaga", "Mijas"], "ciudad")}, de {opt(guion.precio, (x) => setGuion({ ...guion, precio: x }), ["331.000 €", "695.000 €", "185.000 €"], "precio")}. {opt(guion.contexto, (x) => setGuion({ ...guion, contexto: x }), ["Quiere más información sobre el inmueble.", "Quiere agendar una visita."], "contexto")} ¿Te pasamos la llamada?
            </div>
          </>
        )}

        {/* PASO 7 */}
        {paso === 7 && (
          <div className={s.success} style={{ paddingTop: 10 }}>
            <div className={s.successIcon}><PhoneForwarded size={38} /></div>
            <h3 className={s.successTitle}>Transferencia lista</h3>
            <p className={s.successText}>Llamada transferida a <b>{C.asesor}</b> con todo el contexto. Confirma para cerrar la gestión.</p>
          </div>
        )}

        {msg && (
          <div className={`${s.banner} ${msg.tipo === "ok" ? s.bannerOk : s.bannerBad}`}>
            {msg.tipo === "ok" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />} {msg.txt}
          </div>
        )}

        <div className={s.tip}>
          <Lightbulb size={18} style={{ flex: "none" }} />
          <span>Cada dato cuenta: una gestión bien hecha evita reprocesos y mejora la experiencia del cliente.</span>
        </div>

        <div className={s.actions}>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={onSalir}><ArrowLeft size={16} /> Volver al menú</button>
          <button className={`${s.btn} ${s.btnPrimary} ${s.spacer}`} onClick={validarPaso}>
            {paso === 7 ? <>Finalizar gestión <CheckCircle2 size={16} /></> : <>Continuar <ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
