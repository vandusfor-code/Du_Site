"use client";
// Portada: título, sobre 3D con sello (mantener pulsado) y botón alternativo.
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { CumpleCfg } from "./config";
import { Chevron, Codigo, Musica, Silencio } from "./icons";
import { despertar, setSonido, sonidoActivo } from "./audio";
import { desbloquear } from "./musica";

const CoverScene = dynamic(() => import("./CoverScene"), { ssr: false });

function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// ¿Equipo potente? Decide si se activan efectos extra (resplandor, más partículas).
function equipoPotente() {
  const n = navigator as Navigator & { deviceMemory?: number };
  const nucleos = n.hardwareConcurrency || 4;
  const mem = n.deviceMemory || 4;
  const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return !reducido && nucleos >= 6 && mem >= 4;
}

export default function Portada({ cfg, onAbierto }: { cfg: CumpleCfg; onAbierto: () => void }) {
  const [abrir, setAbrir] = useState(false);
  const [prog, setProg] = useState(0);
  const [rompe, setRompe] = useState(false);
  const [web, setWeb] = useState<boolean | null>(null);
  const [alta, setAlta] = useState(true);
  const [snd, setSnd] = useState(true);
  const [fin, setFin] = useState(false);

  useEffect(() => {
    setWeb(hayWebGL());
    setAlta(equipoPotente());
    setSnd(sonidoActivo());
  }, []);

  const letra = (cfg.anfitrion.trim()[0] || "D").toUpperCase();
  const tituloCarta = useMemo(() => ["THE NEXT", "CHAPTER"], []);
  const subCarta = `// ${cfg.anfitrion} · v${cfg.version}`;

  const empezar = () => {
    despertar();
    desbloquear();
    // iOS pide permiso explícito para el giroscopio (debe ir dentro de un toque)
    const DO = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (DO && typeof DO.requestPermission === "function") DO.requestPermission().catch(() => {});
    if (web === false) {
      setRompe(true);
      setTimeout(onAbierto, 700);
      return;
    }
    setAbrir(true);
  };

  return (
    <motion.div className="cm-portada" initial={{ opacity: 1 }} animate={{ opacity: fin ? 0 : 1 }} transition={{ duration: 0.55, ease: "easeOut" }} onAnimationComplete={() => fin && onAbierto()}>
      {web && (
        <CoverScene
          letra={letra}
          tituloCarta={tituloCarta}
          subCarta={subCarta}
          abrir={abrir}
          alta={alta}
          onProgreso={setProg}
          onSolicitaAbrir={() => setRompe(true)}
          onAbierto={() => setFin(true)}
        />
      )}

      <div className="cm-pt-ui">
        <motion.div className="cm-win" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <i />
          <i />
          <i />
          <span>birthday_invitation.js</span>
          <b>×</b>
        </motion.div>
        <button
          className="cm-snd"
          aria-label={snd ? "Silenciar efectos" : "Activar efectos de sonido"}
          onClick={() => {
            const v = !snd;
            setSnd(v);
            setSonido(v);
            if (v) despertar();
          }}
        >
          {snd ? <Musica /> : <Silencio />}
        </button>

        <motion.div className="cm-titulo" animate={{ opacity: rompe ? 0 : 1, y: rompe ? -30 : 0, scale: rompe ? 0.96 : 1 }} transition={{ duration: 0.7, ease: "easeInOut" }}>
          <motion.span className="ico" initial={{ opacity: 0, scale: 0.4, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.35, type: "spring", stiffness: 160, damping: 12 }}>
            <Codigo />
          </motion.span>
          <motion.span className="the" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
            THE
          </motion.span>
          <motion.span className="nx" initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.62, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
            NEXT
          </motion.span>
          <motion.span className="ch" initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.78, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
            CHAPTER
          </motion.span>
          <svg className="sub" viewBox="0 0 250 22" aria-hidden="true">
            <motion.path d="M4 15C60 6 130 4 246 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.3, duration: 0.8, ease: "easeOut" }} />
            <motion.path d="M30 19C90 12 160 12 214 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.55, duration: 0.7, ease: "easeOut" }} />
          </svg>
          <motion.p className="cm-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.8 }}>
            {"// "}Cumpleaños de {cfg.anfitrion}
            <br />
            {"// "}Versión: {cfg.version}
            <br />
            {"// "}Modo: <b>{cfg.modoTexto}</b> 🎉
          </motion.p>
        </motion.div>

        <div className="cm-pt-fondo" />

        <motion.div style={{ display: "grid", justifyItems: "center" }} animate={{ opacity: rompe ? 0 : 1, y: rompe ? 30 : 0 }} transition={{ duration: 0.5 }}>
          <motion.button
            className="cm-abrir"
            style={{ ["--p" as string]: prog }}
            onClick={empezar}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.7 }}
            whileHover={{ scale: 1.03 }}
            disabled={rompe || abrir}
          >
            <span>
              <span className="t1">Abrir invitación…</span>
              <span className="t2">¿o miedo?</span>
            </span>
            <span className="go">
              <Chevron width={20} height={20} />
            </span>
          </motion.button>
          <motion.div className="cm-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }}>
            <i />
            o mantén pulsado el sello
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
