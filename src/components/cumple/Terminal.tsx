"use client";
// Terminal interactiva: el invitado puede explorar la invitación y confirmar escribiendo comandos.
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CumpleCfg } from "./config";
import { fechaLarga, horaLarga } from "./config";
import { enlaceMapa, type Rsvp } from "./hooks";
import { confetiCerveza, confetiFiesta, lluviaMatrix } from "./efectos";
import { setSonido, sonidoActivo, sfx } from "./audio";
import { Equis } from "./icons";

type Linea = { k: "in" | "out" | "ok" | "err" | "dim"; t: string };

export interface TermProps {
  cfg: CumpleCfg;
  rsvp: Rsvp;
  abierto: boolean;
  onCerrar: () => void;
  oscuro: boolean;
  setOscuro: (v: boolean) => void;
  irA: (id: string) => void;
  cuenta: { d: number; h: number; m: number; s: number; pasado: boolean } | null;
}

const SECCIONES = ["anfitrion", "cita", "llevar", "rsvp", "final"];

export default function Terminal(p: TermProps) {
  const { cfg, rsvp } = p;
  const nombre = rsvp.inv?.nombre || "invitado";
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [entrada, setEntrada] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const fin = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  const saludado = useRef(false);

  const escribe = useCallback((l: Linea[]) => setLineas((a) => [...a, ...l]), []);

  useEffect(() => {
    if (p.abierto && !saludado.current) {
      saludado.current = true;
      escribe([
        { k: "dim", t: `birthday-shell v${cfg.version} — sesión de ${nombre}` },
        { k: "out", t: "Escribe `help` para ver los comandos. (Pista: hay huevos de pascua 🥚)" },
      ]);
    }
    if (p.abierto) setTimeout(() => inp.current?.focus(), 350);
  }, [p.abierto, cfg.version, nombre, escribe]);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [lineas, p.abierto]);

  const mapa = enlaceMapa(cfg);

  const comandos = useMemo(() => {
    const c: Record<string, (a: string[]) => Promise<Linea[]> | Linea[]> = {
      help: () => [
        { k: "out", t: "Comandos disponibles:" },
        { k: "dim", t: "  fecha          cuándo es la fiesta" },
        { k: "dim", t: "  lugar          dónde es (abre el mapa)" },
        { k: "dim", t: "  llevar         qué puedes llevar" },
        { k: "dim", t: "  cuenta         cuánto falta" },
        { k: "dim", t: "  rsvp si [n]    confirmar (n = personas)" },
        { k: "dim", t: "  rsvp no        no podré ir" },
        { k: "dim", t: "  rsvp estado    ver tu respuesta" },
        { k: "dim", t: "  cd <sección>   anfitrion cita llevar rsvp final" },
        { k: "dim", t: "  whoami · ls · clear · sonido on|off · tema dark|light · exit" },
        { k: "dim", t: "  …y algunos que no te voy a contar." },
      ],
      whoami: () => [{ k: "out", t: rsvp.inv ? `${nombre} — ${rsvp.inv.pases} ${rsvp.inv.pases === 1 ? "cupo" : "cupos"} reservados` : "invitado_misterioso (sin enlace personal)" }],
      fecha: () => [{ k: "ok", t: `${fechaLarga(cfg.fecha)}${cfg.hora ? ` a las ${horaLarga(cfg.hora)}` : ""}` }],
      date: (a) => c.fecha(a),
      lugar: () => {
        window.open(mapa, "_blank", "noopener");
        return [{ k: "ok", t: `${cfg.lugar}${cfg.ciudad ? ` — ${cfg.ciudad}` : ""}` }, { k: "dim", t: "abriendo mapa…" }];
      },
      ubicacion: (a) => c.lugar(a),
      llevar: () => [{ k: "out", t: "// llevar.json" }, ...cfg.llevar.map((x) => ({ k: "ok" as const, t: `  • ${x.t}: ${x.d}` }))],
      cuenta: () => {
        const q = p.cuenta;
        if (!q) return [{ k: "err", t: "no hay fecha configurada" }];
        return [{ k: "ok", t: q.pasado ? "¡Ya empezó la fiesta!" : `T-minus ${q.d}d ${q.h}h ${q.m}m ${q.s}s` }];
      },
      ls: () => [{ k: "out", t: SECCIONES.join("   ") }],
      cd: (a) => {
        const d = (a[0] || "").replace("/", "");
        if (!SECCIONES.includes(d)) return [{ k: "err", t: `cd: ${d || "?"}: no existe. Prueba con: ${SECCIONES.join(", ")}` }];
        p.irA(d);
        return [{ k: "dim", t: `→ ${d}` }];
      },
      rsvp: async (a) => {
        const sub = (a[0] || "estado").toLowerCase();
        if (sub === "estado" || sub === "status") {
          return [{ k: "out", t: rsvp.estado === "pendiente" ? "estado: pendiente. Usa `rsvp si` o `rsvp no`." : rsvp.estado === "confirmado" ? `estado: confirmado (${rsvp.asistentes ?? 1} ${rsvp.asistentes === 1 ? "persona" : "personas"}) ✔` : "estado: no asistirás" }];
        }
        if (!rsvp.puede) return [{ k: "err", t: "Este enlace no tiene invitación personal. Pídele a Duvan tu enlace." }];
        if (sub === "si" || sub === "sí" || sub === "yes") {
          const n = parseInt(a[1] || "", 10);
          const ok = await rsvp.responder("confirmado", isNaN(n) ? undefined : n);
          if (!ok) return [{ k: "err", t: rsvp.error || "no se pudo guardar" }];
          confetiFiesta();
          sfx.exito();
          return [{ k: "ok", t: `✔ confirmado: ${isNaN(n) ? rsvp.inv?.pases ?? 1 : Math.min(n, rsvp.inv?.pases ?? n)} persona(s). ¡Ahí nos vemos!` }];
        }
        if (sub === "no") {
          const ok = await rsvp.responder("declinado");
          return ok ? [{ k: "ok", t: "Anotado. Te vamos a extrañar 😔" }] : [{ k: "err", t: "no se pudo guardar" }];
        }
        return [{ k: "err", t: "uso: rsvp si [n] | rsvp no | rsvp estado" }];
      },
      sudo: () => [{ k: "err", t: `${nombre} no está en el archivo sudoers. Este incidente será reportado… al que reparte la cerveza. 🍺` }],
      rm: (a) => [{ k: "err", t: a.join(" ").includes("-rf") ? "rm: operación cancelada. Borrar la fiesta no está permitido." : "rm: ¿qué quieres borrar?" }],
      git: (a) => (a[0] === "commit" ? [{ k: "ok", t: `[main ${cfg.version}] feat: nuevo capítulo desbloqueado\n 1 file changed, +1 año` }] : [{ k: "out", t: "On branch main\nnothing to commit, party working tree clean" }]),
      npm: (a) => {
        if ((a[0] === "run" && a[1] === "party") || a[0] === "start") {
          confetiFiesta();
          sfx.exito();
          return [{ k: "ok", t: "> birthday@3.0 party\n> node celebrar.js\n🎉 servidor de fiesta escuchando en el puerto 19-dic" }];
        }
        return [{ k: "out", t: "prueba: npm run party" }];
      },
      cerveza: () => {
        confetiCerveza();
        sfx.brindis();
        return [{ k: "ok", t: "🍺 ¡Salud! (con moderación, que mañana hay deploy)" }];
      },
      beer: (a) => c.cerveza(a),
      matrix: () => {
        lluviaMatrix();
        return [{ k: "ok", t: "Despierta, invitado… la fiesta te está buscando." }];
      },
      coffee: () => [{ k: "ok", t: "☕ HTTP 418: soy una tetera. Mejor ven por una cerveza." }],
      ping: () => [{ k: "out", t: `PING ${cfg.corto.toLowerCase()}.fiesta (19.12.2026): 56 bytes\n64 bytes: icmp_seq=0 ttl=64 time=0.3 ms — con muchas ganas de verte` }],
      echo: (a) => [{ k: "out", t: a.join(" ") }],
      sonido: (a) => {
        const v = a[0] !== "off";
        setSonido(v);
        return [{ k: "ok", t: `sonido ${v ? "activado" : "silenciado"}` }];
      },
      tema: (a) => {
        const v = (a[0] || "").toLowerCase();
        if (v === "dark" || v === "oscuro") {
          p.setOscuro(true);
          return [{ k: "ok", t: "modo oscuro activado (para programadores nocturnos)" }];
        }
        if (v === "light" || v === "claro") {
          p.setOscuro(false);
          return [{ k: "ok", t: "modo claro activado" }];
        }
        return [{ k: "out", t: "uso: tema dark | tema light" }];
      },
      clear: () => {
        setLineas([]);
        return [];
      },
      exit: () => {
        p.onCerrar();
        return [];
      },
    };
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, rsvp, nombre, mapa, p.cuenta, p.oscuro]);

  const ejecutar = async (raw: string) => {
    const txt = raw.trim();
    if (!txt) return;
    setHist((h) => [txt, ...h].slice(0, 40));
    setHi(-1);
    escribe([{ k: "in", t: txt }]);
    const [cmd, ...args] = txt.split(/\s+/);
    const fn = comandos[cmd.toLowerCase()];
    if (!fn) {
      sfx.error();
      escribe([{ k: "err", t: `comando no encontrado: ${cmd}. Escribe help.` }]);
      return;
    }
    const out = await fn(args);
    if (out.length) {
      sfx.check();
      escribe(out);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    sfx.tecla();
    if (e.key === "Enter") {
      const v = entrada;
      setEntrada("");
      ejecutar(v);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.min(hist.length - 1, hi + 1);
      if (n >= 0) {
        setHi(n);
        setEntrada(hist[n]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = hi - 1;
      setHi(n);
      setEntrada(n >= 0 ? hist[n] : "");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const m = Object.keys(comandos).filter((k) => k.startsWith(entrada.toLowerCase()));
      if (m.length === 1) setEntrada(m[0] + " ");
    } else if (e.key === "Escape") {
      p.onCerrar();
    }
  };

  const atajos = ["help", "fecha", "lugar", "llevar", "rsvp si", "cerveza"];

  return (
    <AnimatePresence>
      {p.abierto && (
        <motion.div className="cm-terminal" role="dialog" aria-label="Terminal interactiva" initial={{ y: "100%", opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
          <div className="cm-tbar">
            <i />
            <i />
            <i />
            <span>birthday-shell — {sonidoActivo() ? "♪" : "·"} {nombre}</span>
            <button onClick={p.onCerrar} aria-label="Cerrar terminal">
              <Equis width={18} height={18} />
            </button>
          </div>
          <div className="cm-tcuerpo" onClick={() => inp.current?.focus()}>
            {lineas.map((l, i) => (
              <pre key={i} className={`cm-tl ${l.k}`}>
                {l.k === "in" ? (
                  <>
                    <b>❯</b> {l.t}
                  </>
                ) : (
                  l.t
                )}
              </pre>
            ))}
            <div className="cm-tprompt">
              <b>❯</b>
              <input ref={inp} value={entrada} onChange={(e) => setEntrada(e.target.value)} onKeyDown={onKey} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" enterKeyHint="send" aria-label="Comando" placeholder="escribe un comando…" />
            </div>
            <div ref={fin} />
          </div>
          <div className="cm-tatajos">
            {atajos.map((a) => (
              <button key={a} onClick={() => ejecutar(a)}>
                {a}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
