"use client";
// Orquesta la experiencia: portada 3D → compilación → página con scroll continuo + mundo 3D + terminal.
import dynamic from "next/dynamic";
import { motion, useScroll, useSpring } from "framer-motion";
import Lenis from "lenis";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CumpleCfg, Invitado } from "./config";
import Portada from "./Portada";
import Compila from "./Compila";
import Pagina from "./Pagina";
import Terminal from "./Terminal";
import { useCuenta, useRsvp } from "./hooks";
import { Musica, Silencio, Terminal as IcTerminal } from "./icons";
import { despertar, setSonido, sonidoActivo, sfx } from "./audio";

const Mundo = dynamic(() => import("./Mundo"), { ssr: false });

export interface InvProps {
  cfg: CumpleCfg;
  inv: Invitado | null;
  codigo: string | null;
  preview?: boolean;
  /** Salta la portada (se usa en la vista previa del panel). */
  directo?: boolean;
}

function equipoPotente() {
  const n = navigator as Navigator & { deviceMemory?: number };
  const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return !reducido && (n.hardwareConcurrency || 4) >= 6 && (n.deviceMemory || 4) >= 4;
}

export default function Invitacion(props: InvProps) {
  const { cfg } = props;
  const demo = !props.inv && !props.codigo;
  const inv = useMemo<Invitado | null>(() => (demo ? { nombre: "Invitado especial", pases: 4, estado: "pendiente", asistentes: null, respondido: null } : props.inv), [demo, props.inv]);
  const rsvp = useRsvp(inv, props.codigo, props.preview || demo);
  const cuenta = useCuenta(cfg);

  const [fase, setFase] = useState<"portada" | "compila" | "pagina">(props.directo ? "pagina" : "portada");
  const [term, setTerm] = useState(false);
  const [oscuro, setOscuro] = useState(false);
  const [snd, setSnd] = useState(true);
  const [alta, setAlta] = useState(true);
  const lenis = useRef<Lenis | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const barra = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  useEffect(() => {
    setAlta(equipoPotente());
    setSnd(sonidoActivo());
  }, []);

  // bloquear scroll mientras dura la portada y la compilación
  useEffect(() => {
    if (props.directo) return;
    document.documentElement.style.overflow = fase === "pagina" ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [fase, props.directo]);

  // scroll suave (inercia) en la página
  useEffect(() => {
    if (fase !== "pagina") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.current = l;
    let raf = 0;
    const loop = (t: number) => {
      l.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      l.destroy();
      lenis.current = null;
    };
  }, [fase]);

  // modo oscuro (huevo de pascua de la terminal)
  useEffect(() => {
    document.querySelector(".cm-root")?.classList.toggle("cm-dark", oscuro);
    return () => document.querySelector(".cm-root")?.classList.remove("cm-dark");
  }, [oscuro]);

  // atajo: la tecla ` o ~ abre la terminal
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (fase !== "pagina") return;
      const t = e.target as HTMLElement;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (e.key === "`" || e.key === "~") {
        e.preventDefault();
        setTerm((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fase]);

  const irA = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setTerm(false);
    if (lenis.current) lenis.current.scrollTo(el, { offset: -10, duration: 1.4 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      {fase === "portada" && <Portada cfg={cfg} onAbierto={() => setFase("compila")} />}

      {fase !== "portada" && (
        <div ref={raiz} className="cm-contenido">
          {fase === "pagina" && <Mundo alta={alta} />}
          {fase === "pagina" && <motion.div className="cm-progreso" style={{ scaleX: barra }} />}
          <Compila cfg={cfg} onListo={() => setFase("pagina")} />
          {fase === "pagina" && <Pagina cfg={cfg} rsvp={rsvp} demo={demo || !!props.preview} abrirTerminal={() => setTerm(true)} />}
        </div>
      )}

      {fase === "pagina" && (
        <>
          <div className="cm-fabs">
            <button
              className="cm-fab"
              aria-label="Abrir terminal"
              onClick={() => {
                despertar();
                sfx.pop();
                setTerm((v) => !v);
              }}
            >
              <IcTerminal width={22} height={22} />
            </button>
            <button
              className="cm-fab alt"
              aria-label={snd ? "Silenciar efectos" : "Activar efectos de sonido"}
              onClick={() => {
                const v = !snd;
                setSnd(v);
                setSonido(v);
                if (v) {
                  despertar();
                  sfx.pop();
                }
              }}
            >
              {snd ? <Musica width={20} height={20} /> : <Silencio width={20} height={20} />}
            </button>
          </div>
          <Terminal cfg={cfg} rsvp={rsvp} abierto={term} onCerrar={() => setTerm(false)} oscuro={oscuro} setOscuro={setOscuro} irA={irA} cuenta={cuenta} />
        </>
      )}
    </>
  );
}
