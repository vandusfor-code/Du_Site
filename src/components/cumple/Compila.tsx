"use client";
// Pantalla de "compilación": birthday.exe se ejecuta de verdad, línea a línea.
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { CumpleCfg } from "./config";
import { Check, ChevronAbajo, Codigo, Cohete } from "./icons";
import { sfx } from "./audio";

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Resalta lo que va entre *asteriscos* en naranja
function Resalta({ t }: { t: string }) {
  const partes = t.split(/(\*[^*]+\*)/g);
  return (
    <>
      {partes.map((p, i) => (p.startsWith("*") && p.endsWith("*") ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}
    </>
  );
}

export default function Compila({ cfg, onListo }: { cfg: CumpleCfg; onListo: () => void }) {
  const lineas = cfg.compila.filter((l) => l.trim());
  const [hechas, setHechas] = useState(0); // líneas completadas
  const [escribiendo, setEscribiendo] = useState("");
  const [pct, setPct] = useState(0);
  const [listo, setListo] = useState(false);
  const cancelado = useRef(false);
  const listoRef = useRef(onListo);
  listoRef.current = onListo;

  useEffect(() => {
    cancelado.current = false;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      await espera(reducido ? 50 : 650);
      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        const plano = l.replace(/\*/g, "");
        if (!reducido) {
          for (let c = 1; c <= plano.length; c++) {
            if (cancelado.current) return;
            setEscribiendo(plano.slice(0, c));
            if (c % 2 === 0) sfx.tecla();
            await espera(20 + Math.random() * 26);
          }
          await espera(160);
        }
        if (cancelado.current) return;
        setEscribiendo("");
        setHechas(i + 1);
        sfx.check();
        const objetivo = Math.round(((i + 1) / lineas.length) * 100);
        // la barra sube suave
        setPct((p) => {
          let v = p;
          const paso = () => {
            if (cancelado.current) return;
            v = Math.min(objetivo, v + 2);
            setPct(v);
            if (v < objetivo) setTimeout(paso, 16);
          };
          setTimeout(paso, 0);
          return p;
        });
        await espera(reducido ? 40 : 420);
      }
      if (cancelado.current) return;
      await espera(reducido ? 50 : 550);
      setListo(true);
      sfx.cohete();
      setTimeout(() => sfx.exito(), 450);
      setTimeout(() => listoRef.current(), 1300);
    })();
    return () => {
      cancelado.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="cm-compila" aria-label="Preparando la invitación">
      <motion.div initial={{ opacity: 0, scale: 0.6, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 12 }}>
        <Codigo className="ico" />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        Iniciando experiencia<span className="cm-cursor" />
      </motion.h2>

      <motion.div className="cm-term" initial={{ opacity: 0, y: 30, rotateX: 18 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.25, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} style={{ transformPerspective: 900 }}>
        <div className="barra">
          <i />
          <i />
          <i />
          <span>birthday.exe</span>
          <Chevron2 />
        </div>
        <div className="cuerpo">
          {lineas.map((l, i) => {
            const visible = i < hechas || (i === hechas && escribiendo);
            if (!visible) return <div className="cm-linea" key={i} style={{ opacity: 0.25 }}><span className="n">{String(i + 1).padStart(2, "0")}</span></div>;
            const completa = i < hechas;
            return (
              <div className="cm-linea" key={i}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span className="g">&gt;</span>
                <span className="tx">
                  {completa ? <Resalta t={l} /> : escribiendo}
                  {!completa && <span className="cm-cursor" />}
                </span>
                {completa && (
                  <motion.span className="ck" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14 }}>
                    <Check />
                  </motion.span>
                )}
              </div>
            );
          })}
        </div>
        <div className="cm-prog">
          <div className="bar">
            <div style={{ width: `${pct}%` }} />
          </div>
          <b>{pct}%</b>
        </div>
      </motion.div>

      <AnimatePresence>
        {listo && (
          <motion.div className="cm-listo" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
            <motion.span className="pill" initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <motion.span initial={{ x: -10, y: 12, rotate: -10 }} animate={{ x: [-10, 0, 0], y: [12, 0, -3], rotate: [-10, 0, 0] }} transition={{ duration: 0.8, delay: 0.1 }} style={{ display: "inline-flex" }}>
                <Cohete />
              </motion.span>
              ¡Listo!
            </motion.span>
            <p>
              La celebración ha sido compilada con <b>éxito</b>.
            </p>
            <div style={{ display: "grid", justifyItems: "center", marginTop: 10, color: "var(--or)" }}>
              <ChevronAbajo width={30} height={30} className="cm-desliza-i" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Chevron2() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
