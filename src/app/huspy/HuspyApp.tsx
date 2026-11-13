"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck, PhoneForwarded, AudioLines, Workflow, CheckCircle2, Lock,
  ArrowRight, Trophy, RotateCcw, Sparkles,
} from "lucide-react";
import { ASESORAS, type Asesora } from "./data";
import { guardarResultadoHuspy } from "./actions";
import Actividad1 from "./Actividad1";
import Actividad2 from "./Actividad2";
import Actividad3 from "./Actividad3";
import Actividad4 from "./Actividad4";
import s from "./huspy.module.css";

type Vista = "inicio" | "menu" | "act1" | "act2" | "act3" | "act4" | "final";

const MISIONES = [
  { id: "act1", n: 1, icon: ShieldCheck, titulo: "¡No dañes el lead!", desc: "Corrige y valida la ficha del lead antes de guardarla.", min: 15 },
  { id: "act2", n: 2, icon: PhoneForwarded, titulo: "¡Transfiere correctamente!", desc: "Completa el guion oficial y detecta la info que falta.", min: 15 },
  { id: "act3", n: 3, icon: AudioLines, titulo: "¡Tu voz transmite confianza!", desc: "Escucha, compara y elige la comunicación profesional.", min: 15 },
  { id: "act4", n: 4, icon: Workflow, titulo: "Eres responsable de toda la gestión", desc: "Simulación integral: de la llamada a la transferencia.", min: 15 },
] as const;

function Confetti() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 80 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.4 + Math.random() * 1.8,
        color: ["#5b2eff", "#8a6bff", "#16a34a", "#f59e0b", "#e11d48", "#00d1b2"][i % 6],
        rot: Math.random() * 360,
      })),
    []
  );
  return (
    <div className={s.confetti} aria-hidden>
      {piezas.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function HuspyApp() {
  const [vista, setVista] = useState<Vista>("inicio");
  const [nombre, setNombre] = useState<Asesora | "">("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [guardado, setGuardado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [errorGuardar, setErrorGuardar] = useState("");
  const [confeti, setConfeti] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const completadas = Object.keys(scores).length;
  const progreso = Math.round((completadas / MISIONES.length) * 100);
  const notaFinal = useMemo(() => {
    const vals = MISIONES.map((m) => scores[m.id]).filter((v) => typeof v === "number");
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [scores]);

  // Al volver a una vista, sube el scroll para que se vea el inicio de la actividad.
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [vista]);

  function completarActividad(id: string, score: number) {
    setScores((prev) => ({ ...prev, [id]: Math.max(prev[id] ?? 0, score) }));
    setConfeti(true);
    setTimeout(() => setConfeti(false), 2600);
    setVista("menu");
  }

  async function terminarJornada() {
    setGuardado("guardando");
    setErrorGuardar("");
    const res = await guardarResultadoHuspy({
      nombre,
      nota: notaFinal,
      detalle: { ...scores, completadas, total: MISIONES.length },
    });
    if (res.ok) {
      setGuardado("ok");
      setConfeti(true);
      setTimeout(() => setConfeti(false), 3500);
      setVista("final");
    } else {
      setGuardado("error");
      setErrorGuardar(res.error);
    }
  }

  function reiniciar() {
    setScores({});
    setNombre("");
    setGuardado("idle");
    setVista("inicio");
  }

  const inicial = (nombre || "?").charAt(0).toUpperCase();

  return (
    <div className={s.root}>
      {confeti && <Confetti />}
      <div className={s.shell} ref={topRef}>
        {/* Marca */}
        <div className={s.brandBar}>
          <div className={s.brand}>
            <div className={s.logo}>H</div>
            <div>
              <div className={s.brandName}>Huspy · Formación</div>
              <div className={s.brandSub}>Agentes de primer contacto</div>
            </div>
          </div>
          {nombre && vista !== "inicio" && (
            <div className={s.whoChip}><span className={s.whoDot} /> {nombre}</div>
          )}
        </div>

        {/* ---- INICIO ---- */}
        {vista === "inicio" && (
          <div className={`${s.card} ${s.hero} ${s.fadeUp}`}>
            <span className={s.heroKicker}>Jornada de formación</span>
            <h1 className={s.heroTitle}>Domina la gestión de <span>principio a fin</span></h1>
            <p className={s.heroText}>
              Cuatro misiones prácticas para crear leads sin errores, transferir con el guion oficial
              y comunicar con seguridad. Realiza acciones reales, recibe retroalimentación al instante
              y demuestra lo que sabes.
            </p>
            <div className={s.pickLabel}>Selecciona tu nombre para comenzar</div>
            <div className={s.nameGrid}>
              {ASESORAS.map((a) => (
                <button key={a} className={s.nameBtn} onClick={() => { setNombre(a); setVista("menu"); }}>
                  <span className={s.avatar}>{a.charAt(0)}</span>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- MENÚ DE MISIONES ---- */}
        {vista === "menu" && (
          <div className={s.fadeUp}>
            <div className={s.card}>
              <h2 className={s.sectionTitle}>Hola, {nombre} 👋</h2>
              <p className={s.sectionSub}>Completa las 4 misiones. Puedes repetir cualquiera para mejorar tu nota.</p>

              <div className={s.progressWrap}>
                <div className={s.progressTrack}><div className={s.progressFill} style={{ width: `${progreso}%` }} /></div>
                <span className={s.progressLabel}>{completadas}/{MISIONES.length} completadas</span>
              </div>

              <div className={s.missions}>
                {MISIONES.map((m) => {
                  const Icon = m.icon;
                  const hecha = typeof scores[m.id] === "number";
                  return (
                    <button key={m.id} className={s.mission} onClick={() => setVista(m.id as Vista)}>
                      <div className={s.mNum}><Icon size={20} /></div>
                      <div className={s.mTitle}>{m.n}. {m.titulo}</div>
                      <div className={s.mDesc}>{m.desc}</div>
                      <div className={s.mMeta}>
                        <span>⏱ {m.min} min</span>
                        {hecha
                          ? <><span className={s.mDone}><CheckCircle2 size={14} /> Completada</span><span className={s.mScore}>{scores[m.id]}%</span></>
                          : <span className={s.mScore} style={{ color: "var(--muted)" }}>Pendiente</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Terminar jornada */}
            <div className={s.card} style={{ marginTop: 18, textAlign: "center" }}>
              {completadas < MISIONES.length ? (
                <p className={s.sectionSub} style={{ margin: 0 }}>
                  <Lock size={14} style={{ verticalAlign: "-2px" }} /> Completa las {MISIONES.length} misiones para guardar tu resultado.
                </p>
              ) : (
                <>
                  <p className={s.sectionSub} style={{ margin: "0 0 14px" }}>
                    ¡Terminaste las 4 misiones! Tu nota preliminar es <b style={{ color: "var(--violet)" }}>{notaFinal}%</b>.
                  </p>
                  <button className={`${s.btn} ${s.btnOk}`} onClick={terminarJornada} disabled={guardado === "guardando"}>
                    <Trophy size={18} /> {guardado === "guardando" ? "Guardando…" : "Finalizar y guardar mi resultado"}
                  </button>
                  {guardado === "error" && (
                    <div className={`${s.banner} ${s.bannerBad}`} style={{ justifyContent: "center", marginTop: 14 }}>
                      No se pudo guardar: {errorGuardar}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ---- ACTIVIDADES ---- */}
        {vista === "act1" && <Actividad1 onComplete={(sc) => completarActividad("act1", sc)} onSalir={() => setVista("menu")} />}
        {vista === "act2" && <Actividad2 onComplete={(sc) => completarActividad("act2", sc)} onSalir={() => setVista("menu")} />}
        {vista === "act3" && <Actividad3 onComplete={(sc) => completarActividad("act3", sc)} onSalir={() => setVista("menu")} />}
        {vista === "act4" && <Actividad4 onComplete={(sc) => completarActividad("act4", sc)} onSalir={() => setVista("menu")} />}

        {/* ---- FINAL ---- */}
        {vista === "final" && (
          <div className={`${s.card} ${s.success} ${s.pop}`}>
            <div className={s.successIcon}><Trophy size={42} /></div>
            <h2 className={s.successTitle}>¡Gestión completada, {nombre}! 🎉</h2>
            <div className={s.scoreLabel}>Tu nota final</div>
            <div className={s.scoreBig}>{notaFinal}%</div>
            <p className={s.successText}>
              Has realizado correctamente el proceso de atención, registro y transferencia.
              Recuerda que cada dato cuenta: una gestión bien realizada evita reprocesos y mejora
              la experiencia del cliente.
            </p>
            <div className={s.actions} style={{ justifyContent: "center" }}>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={reiniciar}><RotateCcw size={16} /> Hacer de nuevo</button>
            </div>
            <p className={s.sectionSub} style={{ marginTop: 18 }}>
              <Sparkles size={14} style={{ verticalAlign: "-2px" }} /> Tu resultado quedó guardado. ¡Gracias por tu compromiso!
            </p>
          </div>
        )}
      </div>

      {/* Pie */}
      <div style={{ marginTop: 26, color: "var(--muted)", fontSize: 12.5, textAlign: "center" }}>
        Huspy · Plan de formación interno · Datos de práctica ficticios
      </div>
    </div>
  );
}
