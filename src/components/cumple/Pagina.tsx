"use client";
// La página en scroll continuo: anfitrión, cita, qué llevar, RSVP y cierre.
import { AnimatePresence, motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CumpleCfg } from "./config";
import { fechaLarga, horaLarga } from "./config";
import { Calendario, Check, Equis, FlechaArriba, ICONOS_LLEVAR, Mapa, Pin, Reloj, Sobre } from "./icons";
import { descargarIcs, enlaceGoogleCal, enlaceMapa, gyroX, gyroY, useCuenta, useGyro, type Rsvp } from "./hooks";
import { confetiDesde, confetiFiesta } from "./efectos";
import { sfx } from "./audio";

/* ------------------------------------------------------------------ */
/*  Piezas reutilizables                                               */
/* ------------------------------------------------------------------ */
const ease = [0.2, 0.8, 0.2, 1] as const;

function Sec({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`cm-sec ${className}`}>
      {children}
    </section>
  );
}

function Ojo({ children }: { children: ReactNode }) {
  return (
    <motion.div className="cm-eyebrow" initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-10%" }} transition={{ duration: 0.6, ease }}>
      <span>{"//"}</span> {children}
    </motion.div>
  );
}

/** Revela el texto palabra por palabra. */
function Palabras({ texto, className = "" }: { texto: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const visto = useInView(ref, { once: true, margin: "-12%" });
  const ps = texto.split(" ");
  return (
    <p ref={ref} className={className}>
      {ps.map((w, i) => (
        <motion.span key={i} style={{ display: "inline-block", whiteSpace: "pre" }} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={visto ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}} transition={{ delay: i * 0.045, duration: 0.5, ease }}>
          {w + (i < ps.length - 1 ? " " : "")}
        </motion.span>
      ))}
    </p>
  );
}

/** Tarjeta que se inclina en 3D con el puntero o el giroscopio. */
function Tilt({ children, max = 9, className = "", glare = true }: { children: ReactNode; max?: number; className?: string; glare?: boolean }) {
  useGyro();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform([py, gyroY], ([a, b]) => -(a as number) * max - (b as number) * max * 0.6), { stiffness: 170, damping: 16 });
  const ry = useSpring(useTransform([px, gyroX], ([a, b]) => (a as number) * max + (b as number) * max * 0.8), { stiffness: 170, damping: 16 });
  const gx = useTransform(px, [-0.5, 0.5], ["20%", "80%"]);
  const gy = useTransform(py, [-0.5, 0.5], ["20%", "80%"]);
  return (
    <div className="cm-tilt-w" style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        className={`cm-tilt ${className}`}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
      >
        {children}
        {glare && <motion.span className="cm-glare" style={{ ["--gx" as string]: gx, ["--gy" as string]: gy }} aria-hidden />}
      </motion.div>
    </div>
  );
}

/** Botón que se siente atraído por el puntero. */
function Magnetico({ children, className = "", onClick, href, target, disabled, type }: { children: ReactNode; className?: string; onClick?: () => void; href?: string; target?: string; disabled?: boolean; type?: "button" }) {
  const x = useSpring(0, { stiffness: 220, damping: 14 });
  const y = useSpring(0, { stiffness: 220, damping: 14 });
  const ref = useRef<HTMLElement | null>(null);
  const mv = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.18);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.28);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  if (href)
    return (
      <motion.a ref={ref as React.Ref<HTMLAnchorElement>} href={href} target={target} rel="noopener noreferrer" className={className} style={{ x, y }} onPointerMove={mv} onPointerLeave={reset} whileTap={{ scale: 0.96 }} onClick={() => sfx.pop()}>
        {children}
      </motion.a>
    );
  return (
    <motion.button ref={ref as React.Ref<HTMLButtonElement>} type={type || "button"} className={className} style={{ x, y }} onPointerMove={mv} onPointerLeave={reset} whileTap={{ scale: 0.96 }} onClick={onClick} disabled={disabled}>
      {children}
    </motion.button>
  );
}

/** Bloque de código que se escribe línea a línea. */
function Bloque({ lineas, className = "" }: { lineas: ReactNode[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visto = useInView(ref, { once: true, margin: "-15%" });
  return (
    <motion.div ref={ref} className={`cm-code ${className}`} initial={{ opacity: 0, y: 20 }} animate={visto ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease }}>
      {lineas.map((l, i) => (
        <motion.div key={i} className="ln" initial={{ opacity: 0, x: -8 }} animate={visto ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.35 + i * 0.22, duration: 0.4 }}>
          {l}
        </motion.div>
      ))}
    </motion.div>
  );
}
const K = ({ c }: { c: string }) => <span className="k">{c}</span>;
const S = ({ c }: { c: string }) => <span className="s">&quot;{c}&quot;</span>;

/* ------------------------------------------------------------------ */
/*  1 · Anfitrión                                                      */
/* ------------------------------------------------------------------ */
function Anfitrion({ cfg }: { cfg: CumpleCfg }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yImg = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  const sc = useTransform(scrollYProgress, [0, 0.5, 1], [1.16, 1.06, 1.16]);
  return (
    <Sec id="anfitrion">
      <Ojo>El anfitrión</Ojo>
      <div className="cm-hola">
        <motion.h2 className="cm-h2" initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 0.9, ease }}>
          ¡Hola!
        </motion.h2>
        <motion.span className="mano" initial={{ opacity: 0, scale: 0.3, rotate: -30 }} whileInView={{ opacity: 1, scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.5 }}>
          <motion.span style={{ display: "inline-block", transformOrigin: "70% 80%" }} animate={{ rotate: [0, 18, -8, 16, -4, 12, 0] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}>
            👋
          </motion.span>
          <svg viewBox="0 0 60 50" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.path key={i} d={["M12 30 C 18 22, 22 16, 28 8", "M26 34 C 34 28, 40 24, 50 20", "M34 44 C 42 42, 50 42, 58 42"][i]} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.12, duration: 0.4 }} />
            ))}
          </svg>
        </motion.span>
      </div>
      <Palabras texto={cfg.saludo} className="cm-lead" />

      <div ref={ref}>
        <Tilt className="cm-foto">
          <div className="marco">
            <motion.img src={cfg.foto} alt={cfg.anfitrion} style={{ y: yImg, scale: sc }} draggable={false} />
          </div>
          <svg className="esq e1" viewBox="0 0 60 60" aria-hidden>
            <motion.path d="M4 56 V22 Q4 4 22 4 H56" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.3 }} />
          </svg>
          <svg className="esq e2" viewBox="0 0 60 60" aria-hidden>
            <motion.path d="M56 4 V38 Q56 56 38 56 H4" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.5 }} />
          </svg>
        </Tilt>
      </div>

      <Bloque
        lineas={[
          <>
            <K c="const" /> cumpleaños = {"{"}
          </>,
          <>
            &nbsp;&nbsp;version: <S c={cfg.version} />,
          </>,
          <>
            &nbsp;&nbsp;motivo: <S c={cfg.motivo} />,
          </>,
          <>
            &nbsp;&nbsp;modo: <S c={cfg.modo} />
          </>,
          <>{"}"}</>,
        ]}
      />
    </Sec>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · La cita                                                        */
/* ------------------------------------------------------------------ */
function Digito({ v, etiqueta }: { v: number; etiqueta: string }) {
  const t = String(v).padStart(2, "0");
  return (
    <div className="cd-c">
      <div className="cd-n">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={t} initial={{ y: "70%", opacity: 0, rotateX: -70 }} animate={{ y: 0, opacity: 1, rotateX: 0 }} exit={{ y: "-70%", opacity: 0, rotateX: 70 }} transition={{ duration: 0.35, ease }}>
            {t}
          </motion.span>
        </AnimatePresence>
      </div>
      <small>{etiqueta}</small>
    </div>
  );
}

function Luces() {
  // guirnalda de focos que parpadea suave
  const bombillas = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return { x: 6 + t * 288, y: 14 + Math.sin(t * Math.PI) * 26 + (i % 2) * 3, d: i * 0.37 };
  });
  return (
    <svg className="luces" viewBox="0 0 300 70" aria-hidden>
      <path d="M0 8 Q150 70 300 8" fill="none" stroke="#5b4b3a" strokeWidth="1.6" />
      {bombillas.map((b, i) => (
        <g key={i} style={{ animationDelay: `${b.d}s` }} className="foco">
          <line x1={b.x} y1={b.y - 6} x2={b.x} y2={b.y} stroke="#5b4b3a" strokeWidth="1.4" />
          <circle cx={b.x} cy={b.y + 6} r="14" fill="url(#gl)" />
          <circle cx={b.x} cy={b.y + 6} r="5" fill="#FFE6A8" stroke="#F0A93A" strokeWidth="1" />
        </g>
      ))}
      <defs>
        <radialGradient id="gl">
          <stop offset="0" stopColor="#FFC45C" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFC45C" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function Cita({ cfg, cuenta }: { cfg: CumpleCfg; cuenta: ReturnType<typeof useCuenta> }) {
  const mapa = enlaceMapa(cfg);
  const filas = [
    { ic: <Calendario />, t: "Fecha", d: fechaLarga(cfg.fecha) },
    { ic: <Reloj />, t: "Hora", d: cfg.hora ? `Desde las ${horaLarga(cfg.hora)}` : "Por confirmar" },
    { ic: <Pin />, t: "Lugar", d: [cfg.lugar, cfg.ciudad].filter(Boolean).join("\n") },
  ];
  return (
    <Sec id="cita">
      <Ojo>Detalles del evento</Ojo>
      <div className="cm-titrow">
        <motion.span className="cm-bigico" initial={{ rotate: -90, scale: 0.3, opacity: 0 }} whileInView={{ rotate: 0, scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 160, damping: 12 }}>
          <Calendario />
        </motion.span>
        <h2 className="cm-h2 sub">
          La Cita
          <svg viewBox="0 0 200 14" aria-hidden>
            <motion.path d="M4 9C50 2 120 2 196 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.3 }} />
          </svg>
        </h2>
      </div>

      <div className="cm-cards">
        {filas.map((f, i) => (
          <motion.div key={i} className="cm-card" initial={{ opacity: 0, x: i % 2 ? 40 : -40, rotateY: i % 2 ? -12 : 12 }} whileInView={{ opacity: 1, x: 0, rotateY: 0 }} viewport={{ once: true, margin: "-8%" }} transition={{ duration: 0.7, delay: i * 0.08, ease }} whileHover={{ y: -3 }}>
            <span className="ci">{f.ic}</span>
            <span className="ct">
              <b>{f.t}</b>
              <span style={{ whiteSpace: "pre-line" }}>{f.d}</span>
            </span>
          </motion.div>
        ))}
      </div>

      {cuenta && !cuenta.pasado && (
        <motion.div className="cm-cd" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
          <div className="cd-t">
            <span>{"//"}</span> t-minus para la fiesta
          </div>
          <div className="cd-row">
            <Digito v={cuenta.d} etiqueta="días" />
            <i>:</i>
            <Digito v={cuenta.h} etiqueta="horas" />
            <i>:</i>
            <Digito v={cuenta.m} etiqueta="min" />
            <i>:</i>
            <Digito v={cuenta.s} etiqueta="seg" />
          </div>
        </motion.div>
      )}
      {cuenta?.pasado && <div className="cm-cd"><div className="cd-t">¡La fiesta ya empezó! 🎉</div></div>}

      <div className="cm-acciones">
        <Magnetico href={mapa} target="_blank" className="cm-btn-o">
          <Mapa width={20} height={20} /> Ver ubicación <FlechaArriba width={16} height={16} />
        </Magnetico>
        <div className="cm-cal">
          <button onClick={() => { sfx.pop(); descargarIcs(cfg); }}>
            <Calendario width={16} height={16} /> Añadir al calendario
          </button>
          <a href={enlaceGoogleCal(cfg)} target="_blank" rel="noopener noreferrer" onClick={() => sfx.pop()}>
            Google Calendar
          </a>
        </div>
      </div>

      <Tilt className="cm-lugar" max={6}>
        {cfg.fotoLugar ? <img src={cfg.fotoLugar} alt={cfg.lugar} draggable={false} /> : <div className="patio" />}
        <Luces />
        <div className="nom">{cfg.lugar}</div>
      </Tilt>
    </Sec>
  );
}

/* ------------------------------------------------------------------ */
/*  3 · Qué llevar                                                     */
/* ------------------------------------------------------------------ */
function Llevar({ cfg }: { cfg: CumpleCfg }) {
  return (
    <Sec id="llevar">
      <Ojo>¿Qué llevar?</Ojo>
      <div className="cm-titrow col">
        <motion.span className="cm-bigico caja" initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 130, damping: 9 }}>
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M8 22l24-10 24 10v24L32 56 8 46z" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1 }} />
            <motion.path d="M8 22l24 10 24-10M32 32v24M20 17l24 10" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.25 }} />
          </svg>
        </motion.span>
        <h2 className="cm-h2 sub">{cfg.llevarTitulo}</h2>
      </div>
      <Palabras texto={cfg.llevarIntro} className="cm-p mono" />
      <div className="cm-cards">
        {cfg.llevar.map((it, i) => {
          const Ico = ICONOS_LLEVAR[it.ic] || ICONOS_LLEVAR.otro;
          return (
            <Tilt key={i} className="cm-card llevar" max={7}>
              <motion.div className="fila" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-6%" }} transition={{ duration: 0.65, delay: i * 0.1, ease }}>
                <span className="ci big">
                  <Ico />
                </span>
                <span className="ct">
                  <b>{it.t}</b>
                  <span>{it.d}</span>
                </span>
              </motion.div>
            </Tilt>
          );
        })}
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------------ */
/*  4 · RSVP                                                           */
/* ------------------------------------------------------------------ */
function RsvpSec({ cfg, rsvp, abrirTerminal, demo }: { cfg: CumpleCfg; rsvp: Rsvp; abrirTerminal: () => void; demo: boolean }) {
  const pases = rsvp.inv?.pases ?? 1;
  const [n, setN] = useState(rsvp.asistentes ?? pases);
  const [cambiando, setCambiando] = useState(false);
  const respondido = rsvp.estado !== "pendiente" && !cambiando;

  const si = async () => {
    sfx.pop();
    const ok = await rsvp.responder("confirmado", n);
    if (ok) {
      setCambiando(false);
      sfx.exito();
      confetiDesde(document.querySelector(".cm-btn-si"));
      setTimeout(confetiFiesta, 250);
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    }
  };
  const no = async () => {
    sfx.pop();
    const ok = await rsvp.responder("declinado");
    if (ok) setCambiando(false);
  };

  return (
    <Sec id="rsvp">
      <Ojo>Confirma tu asistencia</Ojo>
      <div className="cm-titrow col">
        <motion.span className="cm-bigico sobre" initial={{ y: -20, opacity: 0, rotate: -12 }} whileInView={{ y: 0, opacity: 1, rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 150, damping: 10 }}>
          <Sobre />
        </motion.span>
        <h2 className="cm-h2 sub">¿Vienes?</h2>
      </div>
      <p className="cm-p mono">{cfg.rsvpIntro}</p>
      {rsvp.inv && (
        <motion.div className="cm-quien" initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
          <span>{"//"} invitación para</span>
          <b>{rsvp.inv.nombre}</b>
          <small>
            {pases} {pases === 1 ? "cupo reservado" : "cupos reservados"}
          </small>
        </motion.div>
      )}
      {demo && <p className="cm-aviso">Vista de prueba: tu respuesta no se guarda. Con tu enlace personal sí quedará registrada.</p>}

      <AnimatePresence mode="wait" initial={false}>
        {respondido ? (
          <motion.div key="ok" className={`cm-ticket ${rsvp.estado}`} initial={{ opacity: 0, rotateX: -80, y: 30 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: "spring", stiffness: 140, damping: 16 }} style={{ transformPerspective: 800 }}>
            <div className="tk-ic">
              {rsvp.estado === "confirmado" ? (
                <svg viewBox="0 0 52 52" aria-hidden>
                  <motion.circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
                  <motion.path d="M15 27l8 8 14-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5 }} />
                </svg>
              ) : (
                <Equis width={44} height={44} />
              )}
            </div>
            <h3>{rsvp.estado === "confirmado" ? "¡Confirmado!" : "Gracias por avisar"}</h3>
            <p>{rsvp.estado === "confirmado" ? `Te esperamos el ${fechaLarga(cfg.fecha).toLowerCase()}.` : "Te vamos a extrañar. Si cambias de opinión, aquí estaré."}</p>
            <div className="cm-code mini">
              <div className="ln">
                <K c="const" /> rsvp = {"{"} asistente: <S c={rsvp.inv?.nombre || "tú"} />, {rsvp.estado === "confirmado" ? <>personas: <span className="n">{rsvp.asistentes ?? 1}</span></> : <>estado: <S c="no_asiste" /></>} {"}"}
              </div>
            </div>
            <button className="cm-lnk" onClick={() => setCambiando(true)}>
              Cambiar mi respuesta
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {pases > 1 && (
              <div className="cm-pers">
                <span>¿Cuántos vienen?</span>
                <div>
                  <button aria-label="Menos" onClick={() => { sfx.pop(); setN((v) => Math.max(1, v - 1)); }}>
                    −
                  </button>
                  <b>{n}</b>
                  <button aria-label="Más" onClick={() => { sfx.pop(); setN((v) => Math.min(pases, v + 1)); }}>
                    +
                  </button>
                </div>
                <small>de {pases}</small>
              </div>
            )}
            <div className="cm-rsvp-b">
              <Magnetico className="cm-btn-si" onClick={si} disabled={rsvp.enviando || !rsvp.puede}>
                <Check width={22} height={22} /> ¡Sí, ahí estaré! <span aria-hidden>🎉</span>
              </Magnetico>
              <Magnetico className="cm-btn-no" onClick={no} disabled={rsvp.enviando || !rsvp.puede}>
                <Equis width={20} height={20} /> No podré ir <span aria-hidden>😔</span>
              </Magnetico>
            </div>
            {rsvp.error && <p className="cm-err">{rsvp.error}</p>}
            {!rsvp.puede && <p className="cm-aviso">Este enlace no tiene una invitación personal. Pídele a Duvan tu enlace.</p>}
            <button className="cm-lnk term" onClick={abrirTerminal}>
              ¿Prefieres hacerlo como programador? <b>abre la terminal →</b>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {cfg.confirmarAntes && <p className="cm-peq">Confirma antes del {fechaLarga(cfg.confirmarAntes).toLowerCase()}.</p>}
    </Sec>
  );
}

/* ------------------------------------------------------------------ */
/*  5 · Cierre                                                         */
/* ------------------------------------------------------------------ */
function Jarras({ activo }: { activo: boolean }) {
  const Jarra = ({ lado }: { lado: 1 | -1 }) => (
    <motion.svg viewBox="0 0 120 140" className="jarra" style={{ transformOrigin: lado === 1 ? "80% 100%" : "20% 100%", scaleX: lado }} animate={activo ? { rotate: [0, -6, 16, 16, 0] } : { rotate: 0 }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, times: [0, 0.2, 0.5, 0.6, 1], ease: "easeInOut" }}>
      <defs>
        <linearGradient id={`cv${lado}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC24A" />
          <stop offset="1" stopColor="#E9870F" />
        </linearGradient>
      </defs>
      <path d="M92 44h12a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H92" fill="none" stroke="#F07F13" strokeWidth="7" strokeLinecap="round" />
      <path d="M26 38h66v72a14 14 0 0 1-14 14H40a14 14 0 0 1-14-14z" fill="url(#cv1)" stroke="#F07F13" strokeWidth="4" strokeLinejoin="round" />
      <path d="M22 42c-6-14 4-26 16-24 4-10 22-10 28-2 14-4 28 4 28 22z" fill="#FFF8E7" stroke="#F0C27A" strokeWidth="3" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle key={i} cx={40 + i * 9} cy={100} r={2.2} fill="#FFE9B0" opacity="0.9" animate={activo ? { cy: [104, 60], opacity: [0, 0.9, 0] } : {}} transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }} />
      ))}
      <path d="M36 56v50" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
    </motion.svg>
  );
  return (
    <div className="cm-jarras" aria-hidden>
      <Jarra lado={1} />
      <Jarra lado={-1} />
      <motion.div className="chispas" animate={activo ? { opacity: [0, 1, 0], scale: [0.4, 1.2, 1.5] } : { opacity: 0 }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, times: [0, 0.52, 1] }}>
        <svg viewBox="0 0 80 60">
          {[[40, 6, 40, 20], [14, 14, 24, 24], [66, 14, 56, 24], [4, 38, 20, 38], [76, 38, 60, 38]].map((l, i) => (
            <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#F07F13" strokeWidth="3.5" strokeLinecap="round" />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}

function Final({ cfg }: { cfg: CumpleCfg }) {
  const ref = useRef<HTMLDivElement>(null);
  const visto = useInView(ref, { margin: "-20%" });
  useEffect(() => {
    if (visto) {
      const id = setTimeout(() => sfx.brindis(), 900);
      return () => clearTimeout(id);
    }
  }, [visto]);
  return (
    <Sec id="final">
      <Ojo>Mensaje final</Ojo>
      <div ref={ref}>
        <motion.h2 className="cm-h2 fin" initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }} whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 1, ease }}>
          ¡Te espero!
          <svg viewBox="0 0 60 40" className="chisp" aria-hidden>
            {["M10 30 L22 14", "M30 28 L34 6", "M46 32 L58 20"].map((d, i) => (
              <motion.path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 + i * 0.12, duration: 0.4 }} />
            ))}
          </svg>
        </motion.h2>
      </div>
      <Palabras texto={cfg.finalTexto} className="cm-lead center" />
      <Bloque
        className="center"
        lineas={[
          <>
            nextChapter() {"{"}
          </>,
          <>
            &nbsp;&nbsp;<K c="return" /> <S c={cfg.finalCodigo} />;
          </>,
          <>{"}"}</>,
        ]}
      />
      <Jarras activo={visto} />
      <footer className="cm-pie">
        <div>{"// fin del archivo · v"}{cfg.version}</div>
        <div>
          Diseñado y programado por <b>Duván Ramos</b>
        </div>
      </footer>
    </Sec>
  );
}

/* ------------------------------------------------------------------ */
export interface PaginaProps {
  cfg: CumpleCfg;
  rsvp: Rsvp;
  demo: boolean;
  abrirTerminal: () => void;
}

export default function Pagina({ cfg, rsvp, demo, abrirTerminal }: PaginaProps) {
  const cuenta = useCuenta(cfg);
  return (
    <div className="cm-pagina">
      <Anfitrion cfg={cfg} />
      <div className="cm-sep" />
      <Cita cfg={cfg} cuenta={cuenta} />
      <div className="cm-sep" />
      <Llevar cfg={cfg} />
      <div className="cm-sep" />
      <RsvpSec cfg={cfg} rsvp={rsvp} abrirTerminal={abrirTerminal} demo={demo} />
      <div className="cm-sep" />
      <Final cfg={cfg} />
    </div>
  );
}
export { useCuenta };
