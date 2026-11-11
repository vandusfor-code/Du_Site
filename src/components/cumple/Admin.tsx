"use client";
// Panel del anfitrión: resumen de respuestas, editor de la invitación e invitados.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULTS, fechaLarga, horaLarga, mezclar, objetivo, type CumpleCfg, type IconoLlevar, type Invitado } from "./config";
import { rpc, subirArchivo, comprimirImagen } from "./api";
import { activarAvisos, desactivarAvisos, esApp, esIOS, instalar, prepararApp, registrarSW, sincronizarAvisos, soportaPush } from "./avisos";
import { Calendario, Campana, Check, Equis, Movil, Sobre } from "./icons";

interface Inv extends Invitado {
  codigo: string;
  visto: string | null;
  creado: string;
}
interface Datos {
  evento_id: string;
  config: unknown;
  invitados: Inv[];
}

const ICONOS: { v: IconoLlevar; t: string }[] = [
  { v: "trago", t: "Bebida" },
  { v: "comida", t: "Comida" },
  { v: "regalo", t: "Regalo" },
  { v: "musica", t: "Música" },
  { v: "foto", t: "Fotos" },
  { v: "ropa", t: "Ropa" },
  { v: "otro", t: "Otro" },
];

const estadoTxt = { confirmado: "Confirmó", pendiente: "Pendiente", declinado: "No asiste" } as const;
const pct = (a: number, b: number) => (b ? Math.round((a * 100) / b) : 0);
const fechaCorta = (s: string | null) => (s ? new Date(s).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Tab = "resumen" | "editar" | "invitados";

export default function Admin({ adminKey }: { adminKey: string }) {
  const [carga, setCarga] = useState<"cargando" | "ok" | "error">("cargando");
  const [msgError, setMsgError] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [cfg, setCfg] = useState<CumpleCfg>(DEFAULTS);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [tab, setTab] = useState<Tab>("resumen");
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ t: string; err?: boolean } | null>(null);
  const [avisoSub, setAvisoSub] = useState(false);
  const [instalaOculta, setInstalaOculta] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Inv["estado"]>("todos");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPases, setNuevoPases] = useState(1);
  const [lote, setLote] = useState("");
  const [creada, setCreada] = useState<{ nombre: string; codigo: string } | null>(null);
  const [modal, setModal] = useState<null | { titulo: string; cuerpo?: string; campos?: { k: string; label: string; valor: string; tipo?: string }[]; si: string; no?: string; res: (v: Record<string, string> | null) => void }>(null);
  const previo = useRef<{ tot: number; resp: number; pend: number; conf: number; dec: number; pers: number; ts: number } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ahora, setAhora] = useState(0);

  const aviso = useCallback((t: string, err?: boolean) => {
    setToast({ t, err });
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 3400);
  }, []);

  const base = typeof window !== "undefined" ? location.origin + location.pathname : "";
  const enlace = (c: string) => `${base}?i=${c}`;

  /* ---------- carga ---------- */
  const cargar = useCallback(
    async (silencio = false) => {
      try {
        const d = await rpc<Datos>("boda_admin_get", { p_key: adminKey });
        setEventoId(d.evento_id);
        setInvs(d.invitados || []);
        if (!silencio) setCfg(mezclar(DEFAULTS, d.config));
        setCarga("ok");
        return d;
      } catch (e) {
        if (!silencio) {
          setCarga("error");
          setMsgError((e as { code?: string }).code === "clave_invalida" ? "Este enlace de administración no es correcto." : "No pudimos conectarnos. Revisa tu internet e inténtalo otra vez.");
        }
        return null;
      }
    },
    [adminKey]
  );

  useEffect(() => {
    try {
      previo.current = JSON.parse(localStorage.getItem("cumple-visto-" + adminKey.slice(0, 8)) || "null");
    } catch {}
    cargar();
  }, [cargar, adminKey]);

  // tictac para la cuenta regresiva y refresco de respuestas
  useEffect(() => {
    setAhora(Date.now());
    const a = setInterval(() => setAhora(Date.now()), 1000);
    const b = setInterval(() => cargar(true), 30000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [cargar]);

  // app instalable + avisos
  useEffect(() => {
    if (carga !== "ok") return;
    const quitar = prepararApp(`Cumple ${cfg.corto}`);
    registrarSW().then(() => sincronizarAvisos(adminKey, eventoId)).then((ok) => ok && setAvisoSub(true));
    try {
      setInstalaOculta(Date.now() - Number(localStorage.getItem("cumple-instala-cerrada") || 0) < 7 * 864e5);
    } catch {}
    return quitar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga, eventoId]);

  // guarda la foto de esta visita para los "+N" de la próxima
  const numeros = useMemo(() => {
    const conf = invs.filter((i) => i.estado === "confirmado");
    const dec = invs.filter((i) => i.estado === "declinado");
    const pend = invs.filter((i) => i.estado === "pendiente");
    return { tot: invs.length, resp: conf.length + dec.length, pend: pend.length, conf: conf.length, dec: dec.length, pers: conf.reduce((t, i) => t + (i.asistentes || i.pases), 0), listaPend: pend };
  }, [invs]);
  const guardadoVisita = useRef(false);
  useEffect(() => {
    if (carga !== "ok" || guardadoVisita.current) return;
    guardadoVisita.current = true;
    try {
      localStorage.setItem("cumple-visto-" + adminKey.slice(0, 8), JSON.stringify({ ...numeros, listaPend: undefined, ts: Date.now() }));
    } catch {}
  }, [carga, numeros, adminKey]);

  /* ---------- edición ---------- */
  const set = <K extends keyof CumpleCfg>(k: K, v: CumpleCfg[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setDirty(true);
  };
  const setItem = (i: number, campo: "ic" | "t" | "d", v: string) => {
    setCfg((c) => ({ ...c, llevar: c.llevar.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) }));
    setDirty(true);
  };

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      await rpc("boda_admin_guardar", { p_key: adminKey, p_config: { ...cfg, tipo: "cumple" } });
      setDirty(false);
      aviso("Guardado. Ya se actualizó en todas las invitaciones");
    } catch {
      aviso("No se pudo guardar. Revisa tu conexión.", true);
    }
    setGuardando(false);
  };

  const subir = async (e: React.ChangeEvent<HTMLInputElement>, campo: "foto" | "fotoLugar") => {
    const f = e.target.files?.[0];
    if (!f) return;
    aviso("Subiendo…");
    try {
      const url = await subirArchivo(await comprimirImagen(f, 1600), "cumple", "jpg");
      set(campo, url);
      aviso("Listo");
    } catch (err) {
      aviso("No se pudo subir: " + ((err as Error).message || "error"), true);
    }
    e.target.value = "";
  };

  const subirCancion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return aviso("La canción pesa más de 8 MB. Comprímela e inténtalo de nuevo.", true);
    if (!/audio\/(mpeg|mp4|x-m4a)|\.(mp3|m4a)$/i.test(f.type + f.name)) return aviso("Sube un archivo MP3 o M4A", true);
    const m4a = /m4a|mp4/i.test(f.type + f.name);
    aviso("Subiendo canción…");
    try {
      const url = await subirArchivo(new Blob([f], { type: m4a ? "audio/mp4" : "audio/mpeg" }), "cumple", m4a ? "m4a" : "mp3");
      setCfg((c) => ({ ...c, cancion: url, cancionNombre: f.name.replace(/\.[^.]+$/, "").slice(0, 80) }));
      setDirty(true);
      aviso("Canción lista: recuerda guardar los cambios");
    } catch (err) {
      aviso("No se pudo subir: " + ((err as Error).message || "error"), true);
    }
  };

  /* ---------- modal ---------- */
  const pedir = (m: Omit<NonNullable<typeof modal>, "res">) => new Promise<Record<string, string> | null>((res) => setModal({ ...m, res }));

  /* ---------- invitados ---------- */
  const mensajeWA = (nombre: string, codigo: string) => `Hola ${nombre} 🎉 Te invito a mi cumpleaños: THE NEXT CHAPTER. Abre tu invitación aquí: ${enlace(codigo)}`;
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const t = document.createElement("textarea");
      t.value = texto;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    aviso("Enlace copiado");
  };
  const crear = async (items: { nombre: string; pases: number }[], uno: boolean) => {
    const validos = items.filter((i) => i.nombre.trim());
    if (!validos.length) return aviso("Escribe el nombre del invitado", true);
    try {
      const out = await rpc<{ codigo: string; nombre: string }[]>("boda_admin_crear", { p_key: adminKey, p_items: validos });
      await cargar(true);
      if (uno) {
        setCreada(out[0]);
        setNuevoNombre("");
        setNuevoPases(1);
      } else {
        setLote("");
        setCreada(null);
      }
      aviso(uno ? "Invitación generada" : `${out.length} invitaciones generadas`);
    } catch {
      aviso("No se pudo crear. Inténtalo de nuevo.", true);
    }
  };
  const editar = async (i: Inv) => {
    const r = await pedir({ titulo: "Editar invitación", campos: [{ k: "nombre", label: "Nombre", valor: i.nombre }, { k: "pases", label: "Personas", valor: String(i.pases), tipo: "number" }], si: "Guardar", no: "Cancelar" });
    if (!r || !r.nombre.trim()) return;
    try {
      await rpc("boda_admin_editar", { p_key: adminKey, p_codigo: i.codigo, p_nombre: r.nombre, p_pases: Math.max(1, Math.min(30, +r.pases || 1)) });
      await cargar(true);
      aviso("Cambios guardados");
    } catch {
      aviso("No se pudo guardar el cambio", true);
    }
  };
  const borrar = async (i: Inv) => {
    const r = await pedir({ titulo: "¿Eliminar esta invitación?", cuerpo: `Se borrará la invitación de ${i.nombre} y su enlace dejará de funcionar${i.estado !== "pendiente" ? ". Su respuesta también se elimina y dejará de contarse" : ""}.`, si: "Sí, eliminar", no: "No" });
    if (!r) return;
    try {
      await rpc("boda_admin_borrar", { p_key: adminKey, p_codigo: i.codigo });
      await cargar(true);
      aviso("Invitación eliminada");
    } catch {
      aviso("No se pudo eliminar", true);
    }
  };
  const csv = () => {
    const filas = [["Nombre", "Estado", "Personas invitadas", "Personas que asisten", "Respondió", "Enlace"]];
    invs.forEach((i) => filas.push([i.nombre, estadoTxt[i.estado], String(i.pases), i.estado === "confirmado" ? String(i.asistentes || i.pases) : "", i.respondido ? new Date(i.respondido).toLocaleString("es-CO") : "", enlace(i.codigo)]));
    const txt = "﻿" + filas.map((f) => f.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = "invitados-cumple.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---------- app y avisos ---------- */
  const accionInstalar = async () => {
    const r = await instalar();
    if (r === "ok") return aviso("Listo: búscala en tu pantalla de inicio");
    if (r === "cancelado") return;
    await pedir({
      titulo: "Añadir a tu móvil",
      cuerpo: esIOS() ? "1) Toca el botón Compartir (el cuadro con una flecha) en Safari.\n2) Elige «Añadir a pantalla de inicio».\n3) Abre la app desde su icono y activa los avisos." : "1) Abre el menú del navegador (⋮).\n2) Toca «Instalar app» o «Añadir a la pantalla de inicio».\n3) Abre la app desde su icono.",
      si: "Entendido",
    });
  };
  const accionAvisos = async (activar: boolean) => {
    if (activar) {
      const r = await activarAvisos(adminKey, eventoId);
      if (r === "ok") {
        setAvisoSub(true);
        aviso("Avisos activados");
      } else if (r === "denegado") await pedir({ titulo: "Avisos bloqueados", cuerpo: "Tu navegador no nos dejó enviarte avisos. Toca el candado de la barra de direcciones, entra a Notificaciones y elige Permitir.", si: "Entendido" });
      else aviso("No se pudieron activar los avisos. Inténtalo de nuevo.", true);
    } else {
      await desactivarAvisos(adminKey);
      setAvisoSub(false);
      aviso("Avisos desactivados");
    }
  };

  /* ---------- derivados ---------- */
  const lista = invs.filter((i) => (filtro === "todos" || i.estado === filtro) && (!busca || norm(i.nombre).includes(norm(busca))));
  const delta = (k: "tot" | "resp" | "pend" | "conf" | "dec" | "pers") => (previo.current && numeros[k] - previo.current[k] > 0 ? <span className="ad-delta">+{numeros[k] - previo.current[k]}</span> : null);
  const ult = [...invs].filter((i) => i.respondido).sort((a, b) => +new Date(b.respondido!) - +new Date(a.respondido!))[0];
  const t = objetivo(cfg);
  const resta = t && ahora ? Math.max(0, Math.floor((t - ahora) / 1000)) : null;
  const falta: string[] = [];
  if (!cfg.fecha) falta.push("fecha");
  if (!cfg.lugar) falta.push("lugar");
  if (!cfg.mapa) falta.push("enlace de Google Maps");
  if (!cfg.foto || cfg.foto === DEFAULTS.foto) falta.push("tu foto");

  if (carga === "cargando") return <div className="cm-carga"><span>cargando panel<i /></span></div>;
  if (carga === "error")
    return (
      <div className="cm-error">
        <div>
          <h1>Enlace no válido</h1>
          <p>{msgError}</p>
        </div>
      </div>
    );

  const vistaUrl = `${location.pathname}?vista=${encodeURIComponent(adminKey)}`;

  return (
    <div className="ad">
      <header className="ad-top">
        <div className="ad-mono">
          <b>&lt;D/&gt;</b>
          <span>Tu cumpleaños</span>
        </div>
        <a className="ad-ver" href={vistaUrl} target="_blank" rel="noopener noreferrer">
          Vista previa
        </a>
      </header>

      <main className="ad-main">
        {tab === "resumen" && (
          <div className="ad-vista">
            <div className="ad-tit">
              <small>{"// resumen"}</small>
              <h1>{cfg.anfitrion}</h1>
              <p>Así van las respuestas de tus invitados.</p>
            </div>

            {typeof window !== "undefined" && !esApp() && !instalaOculta && (
              <div className="ad-app">
                <span className="ic"><Movil width={22} height={22} /></span>
                <div className="t"><b>Añadir a tu móvil</b><small>Acceso en un toque a tus invitados y RSVP.</small></div>
                <button className="add" onClick={accionInstalar}>Añadir</button>
                <button className="x" aria-label="Cerrar" onClick={() => { try { localStorage.setItem("cumple-instala-cerrada", String(Date.now())); } catch {} setInstalaOculta(true); }}>×</button>
              </div>
            )}
            {typeof window !== "undefined" && soportaPush() && Notification.permission !== "denied" && (
              <div className={`ad-app ${avisoSub ? "ok" : ""}`}>
                <span className="ic"><Campana width={22} height={22} /></span>
                <div className="t"><b>{avisoSub ? "Avisos activados" : "Activa los avisos"}</b><small>{avisoSub ? "Te avisamos al celular cuando alguien responda." : "Recibe una notificación cuando alguien confirme."}</small></div>
                <button className={`add ${avisoSub ? "suave" : ""}`} onClick={() => accionAvisos(!avisoSub)}>{avisoSub ? "Desactivar" : "Activar"}</button>
              </div>
            )}

            {ult && (
              <button className="ad-notif" onClick={() => setTab("invitados")}>
                <span className={`av ${ult.estado}`}>{(ult.nombre.trim()[0] || "?").toUpperCase()}</span>
                <span className="nt">
                  <b>{previo.current && +new Date(ult.respondido!) > previo.current.ts ? "Nueva respuesta" : "Última respuesta"}</b>
                  <small>{ult.nombre} {ult.estado === "confirmado" ? `ha confirmado · ${ult.asistentes || ult.pases} ${(ult.asistentes || ult.pases) === 1 ? "invitado" : "invitados"}` : "no podrá asistir"}</small>
                </span>
              </button>
            )}

            <div className="ad-kpis">
              <div className="k hero">{delta("tot")}<span className="ic"><Sobre width={19} height={19} /></span><b>{numeros.tot}</b><em>Invitaciones creadas</em><small>↗ {numeros.resp} respuestas recibidas</small></div>
              <div className="k resp">{delta("resp")}<span className="ic"><Check width={19} height={19} /></span><b>{numeros.resp}</b><em>Respuestas</em><small>↗ {pct(numeros.resp, numeros.tot)}% de respuesta</small></div>
              <div className="k pend">{delta("pend")}<span className="ic"><Calendario width={19} height={19} /></span><b>{numeros.pend}</b><em>Pendientes</em><small>↗ {pct(numeros.pend, numeros.tot)}% de invitados</small></div>
              <div className="k conf">{delta("conf")}<span className="ic"><Check width={19} height={19} /></span><b>{numeros.conf}</b><em>Confirmados</em><small>↗ {pct(numeros.conf, numeros.resp)}% de respuestas</small></div>
              <div className="k dec">{delta("dec")}<span className="ic"><Equis width={19} height={19} /></span><b>{numeros.dec}</b><em>Rechazados</em><small>↗ {pct(numeros.dec, numeros.resp)}% de respuestas</small></div>
              <div className="k pers">{delta("pers")}<span className="ic"><Campana width={19} height={19} /></span><b>{numeros.pers}</b><em>Total asistentes</em><small>↗ {numeros.conf ? (numeros.pers / numeros.conf).toFixed(1).replace(".", ",") : "0"} de media</small></div>
            </div>

            <button className="ad-estado" onClick={() => (falta.length ? setTab("editar") : window.open(vistaUrl, "_blank"))}>
              <span className="ic"><Sobre width={24} height={24} /></span>
              <span className="et"><small>Estado de la invitación</small><b>{falta.length ? `Faltan ${falta.length} ${falta.length === 1 ? "dato" : "datos"}` : "Lista para enviar"}</b></span>
              <span className="fl">›</span>
            </button>

            {resta != null && (
              <div className="ad-cuenta">
                <h3>Cuenta atrás para el gran día</h3>
                {resta > 0 ? (
                  <div className="row">
                    {[[Math.floor(resta / 86400), "Días"], [Math.floor((resta % 86400) / 3600), "Horas"], [Math.floor((resta % 3600) / 60), "Min"], [resta % 60, "Seg"]].map(([v, l], i) => (
                      <div key={i}><b>{String(v).padStart(2, "0")}</b><span>{l}</span></div>
                    ))}
                  </div>
                ) : <p>¡El gran día ya llegó! 🎉</p>}
              </div>
            )}

            {numeros.listaPend.length > 0 && (
              <section className="ad-rec">
                <h3>Faltan por responder <em>{numeros.pend}</em></h3>
                {numeros.listaPend.slice(0, 4).map((i) => (
                  <div className="f" key={i.codigo}>
                    <div><b>{i.nombre}</b><small>{i.visto ? "Ya abrió su invitación" : "Aún no la abre"}</small></div>
                    <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Hola ${i.nombre} 👋 Te recordamos confirmar tu asistencia a mi cumpleaños. Tu invitación: ${enlace(i.codigo)}`)}`}>Recordar</a>
                  </div>
                ))}
                {numeros.pend > 4 && <button className="ad-lnk" onClick={() => setTab("invitados")}>Ver todos →</button>}
              </section>
            )}
            {numeros.tot === 0 && <p className="ad-vacio">Aún no has creado invitaciones. <button className="ad-lnk" onClick={() => setTab("invitados")}>Crear la primera →</button></p>}
          </div>
        )}

        {tab === "editar" && (
          <div className="ad-vista">
            <div className="ad-tit"><small>{"// editor"}</small><h1>Tu invitación</h1><p>Todo lo que ven tus invitados se edita aquí.</p></div>

            <section className="ad-sec">
              <h2>Anfitrión</h2>
              <label>Nombre completo<input value={cfg.anfitrion} onChange={(e) => set("anfitrion", e.target.value)} /></label>
              <div className="dos">
                <label>Nombre corto<input value={cfg.corto} onChange={(e) => set("corto", e.target.value)} /></label>
              </div>
              <div className="dos">
                <label>Versión<input value={cfg.version} onChange={(e) => set("version", e.target.value)} /></label>
                <label>Modo (portada)<input value={cfg.modoTexto} onChange={(e) => set("modoTexto", e.target.value)} /></label>
              </div>
              <label>Tu foto
                <div className="ad-foto">
                  <img src={cfg.foto} alt="" />
                  <span><input type="file" accept="image/*" onChange={(e) => subir(e, "foto")} /></span>
                </div>
              </label>
              <label>Saludo<textarea rows={3} value={cfg.saludo} onChange={(e) => set("saludo", e.target.value)} /></label>
              <div className="dos">
                <label>Motivo<input value={cfg.motivo} onChange={(e) => set("motivo", e.target.value)} /></label>
                <label>Modo<input value={cfg.modo} onChange={(e) => set("modo", e.target.value)} /></label>
              </div>
            </section>

            <section className="ad-sec">
              <h2>Evento</h2>
              <div className="dos">
                <label>Fecha<input type="date" value={cfg.fecha} onChange={(e) => set("fecha", e.target.value)} /></label>
                <label>Hora<input type="time" value={cfg.hora} onChange={(e) => set("hora", e.target.value)} /></label>
              </div>
              <p className="ad-sub">Se verá: {fechaLarga(cfg.fecha) || "—"}{cfg.hora ? ` · ${horaLarga(cfg.hora)}` : ""}</p>
              <label>Lugar<input value={cfg.lugar} onChange={(e) => set("lugar", e.target.value)} /></label>
              <label>Ciudad<input value={cfg.ciudad} onChange={(e) => set("ciudad", e.target.value)} /></label>
              <label>Dirección (opcional)<input value={cfg.dir} onChange={(e) => set("dir", e.target.value)} /></label>
              <label>Enlace de Google Maps<input type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={cfg.mapa} onChange={(e) => set("mapa", e.target.value)} /></label>
              <p className="ad-sub">En Google Maps busca el lugar → Compartir → Copiar enlace. Si lo dejas vacío, se busca por nombre y ciudad.</p>
              <label>Foto del lugar (opcional)
                <div className="ad-foto">
                  {cfg.fotoLugar ? <img src={cfg.fotoLugar} alt="" /> : <div className="vacia">Sin foto: se muestra la guirnalda de luces</div>}
                  <span><input type="file" accept="image/*" onChange={(e) => subir(e, "fotoLugar")} />{cfg.fotoLugar && <button className="ad-lnk mal" onClick={() => set("fotoLugar", "")}>Quitar</button>}</span>
                </div>
              </label>
              <label>Confirmar asistencia antes del (opcional)<input type="date" value={cfg.confirmarAntes} onChange={(e) => set("confirmarAntes", e.target.value)} /></label>
            </section>

            <section className="ad-sec">
              <h2>¿Qué llevar?</h2>
              <label>Título<input value={cfg.llevarTitulo} onChange={(e) => set("llevarTitulo", e.target.value)} /></label>
              <label>Texto<textarea rows={3} value={cfg.llevarIntro} onChange={(e) => set("llevarIntro", e.target.value)} /></label>
              {cfg.llevar.map((x, i) => (
                <div className="ad-item" key={i}>
                  <select value={x.ic} onChange={(e) => setItem(i, "ic", e.target.value)} aria-label="Icono">{ICONOS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
                  <input value={x.t} placeholder="Título" onChange={(e) => setItem(i, "t", e.target.value)} />
                  <button aria-label="Quitar" onClick={() => { setCfg((c) => ({ ...c, llevar: c.llevar.filter((_, j) => j !== i) })); setDirty(true); }}>×</button>
                  <input className="full" value={x.d} placeholder="Descripción" onChange={(e) => setItem(i, "d", e.target.value)} />
                </div>
              ))}
              <button className="ad-btn sec" onClick={() => { setCfg((c) => ({ ...c, llevar: [...c.llevar, { ic: "otro", t: "", d: "" }] })); setDirty(true); }}>+ Agregar</button>
            </section>

            <section className="ad-sec">
              <h2>Música <small>opcional</small></h2>
              {cfg.cancion ? (
                <div className="ad-cancion">
                  <b>{cfg.cancionNombre || "Tu canción"}</b>
                  <audio controls src={cfg.cancion} preload="none" />
                  <button className="ad-lnk mal" onClick={() => { setCfg((c) => ({ ...c, cancion: "", cancionNombre: "" })); setDirty(true); }}>Quitar canción</button>
                </div>
              ) : (
                <p className="ad-sub" style={{ margin: "0 0 12px" }}>Aún no hay canción: la invitación se verá solo con los efectos de sonido.</p>
              )}
              <label>{cfg.cancion ? "Cambiar canción (MP3)" : "Subir canción (MP3)"}<input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a" onChange={subirCancion} /></label>
              <p className="ad-sub">Máximo 8 MB. Empieza a sonar cuando el invitado desliza después de la compilación; los efectos (terminal, clics, confeti) siguen sonando de fondo. El invitado puede silenciarla con el botón de sonido.</p>
            </section>

            <section className="ad-sec">
              <h2>Confirmación y cierre</h2>
              <label>Texto de «¿Vienes?»<textarea rows={3} value={cfg.rsvpIntro} onChange={(e) => set("rsvpIntro", e.target.value)} /></label>
              <label>Mensaje final<textarea rows={3} value={cfg.finalTexto} onChange={(e) => set("finalTexto", e.target.value)} /></label>
              <label>Frase del código final<input value={cfg.finalCodigo} onChange={(e) => set("finalCodigo", e.target.value)} /></label>
            </section>

            <section className="ad-sec">
              <h2>Compilación <small>birthday.exe</small></h2>
              <label>Una línea por paso (usa *asteriscos* para resaltar en naranja)
                <textarea rows={6} value={cfg.compila.join("\n")} onChange={(e) => set("compila", e.target.value.split("\n"))} />
              </label>
            </section>

            {falta.length > 0 && <p className="ad-falta"><b>Todavía falta:</b> {falta.join(", ")}.</p>}
            <button className={`ad-main-btn ${!dirty && !guardando ? "ok" : ""}`} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : dirty ? "Guardar cambios" : "Todo guardado ✓"}</button>
          </div>
        )}

        {tab === "invitados" && (
          <div className="ad-vista">
            <div className="ad-tit"><small>{"// invitados"}</small><h1>Una para cada invitado</h1><p>Escribe el nombre: cada persona recibe su enlace personal.</p></div>
            <section className="ad-sec">
              <h2>Nueva invitación</h2>
              <label>Nombre del invitado o familia<input value={nuevoNombre} placeholder="Ej: Familia Ramos" maxLength={120} onChange={(e) => setNuevoNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crear([{ nombre: nuevoNombre, pases: nuevoPases }], true)} /></label>
              <div className="ad-pases"><span>Personas</span><div><button onClick={() => setNuevoPases((v) => Math.max(1, v - 1))}>−</button><b>{nuevoPases}</b><button onClick={() => setNuevoPases((v) => Math.min(30, v + 1))}>+</button></div></div>
              <button className="ad-main-btn" onClick={() => crear([{ nombre: nuevoNombre, pases: nuevoPases }], true)}>Generar invitación</button>
              {creada && (
                <div className="ad-nueva">
                  <b>Invitación lista para {creada.nombre}</b>
                  <code>{enlace(creada.codigo)}</code>
                  <div>
                    <button className="ad-btn" onClick={() => copiar(enlace(creada.codigo))}>Copiar enlace</button>
                    <a className="ad-btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(mensajeWA(creada.nombre, creada.codigo))}`}>WhatsApp</a>
                  </div>
                </div>
              )}
              <details>
                <summary>Agregar muchas a la vez</summary>
                <textarea rows={5} value={lote} placeholder={"Una por línea. Personas después de una coma:\nFamilia Ramos, 4\nMaría López, 1"} onChange={(e) => setLote(e.target.value)} />
                <button className="ad-btn sec" onClick={() => crear(lote.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = /^(.*?)[,;]\s*(\d{1,2})$/.exec(l); return m ? { nombre: m[1].trim(), pases: +m[2] } : { nombre: l, pases: 1 }; }), false)}>Generar todas</button>
              </details>
            </section>

            <h2 className="ad-lt">Tus invitaciones <em>{invs.length}</em></h2>
            <div className="ad-barra">
              <input type="search" placeholder="Buscar por nombre" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="chips">
                {([["todos", "Todas"], ["pendiente", "Pendientes"], ["confirmado", "Confirmadas"], ["declinado", "No asisten"]] as const).map(([k, l]) => (
                  <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l} ({k === "todos" ? invs.length : invs.filter((i) => i.estado === k).length})</button>
                ))}
              </div>
              <div className="acc"><button className="ad-btn sec" onClick={() => cargar(true).then(() => aviso("Lista actualizada"))}>Actualizar</button><button className="ad-btn" onClick={csv} disabled={!invs.length}>Descargar lista</button></div>
            </div>
            <div className="ad-lista">
              {lista.length === 0 && <p className="ad-vacio">{invs.length ? "No encontramos ninguna invitación con ese filtro." : "Aún no has creado ninguna invitación."}</p>}
              {lista.map((i) => (
                <div className="ad-ti" key={i.codigo}>
                  <div className="top">
                    <div>
                      <div className="nom">{i.nombre}</div>
                      <div className="meta">{i.estado === "confirmado" ? `Confirmó ${i.asistentes || i.pases} de ${i.pases} · ${fechaCorta(i.respondido)}` : i.estado === "declinado" ? `Avisó que no asiste · ${fechaCorta(i.respondido)}` : `${i.pases} ${i.pases === 1 ? "persona" : "personas"} · ${i.visto ? "La abrió, aún no responde" : "Creada, aún no la abre"}`}</div>
                    </div>
                    <span className={`bd ${i.estado}`}>{estadoTxt[i.estado]}</span>
                  </div>
                  <div className="acts">
                    <button className="ad-btn" onClick={() => copiar(enlace(i.codigo))}>Copiar enlace</button>
                    <a className="ad-btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(mensajeWA(i.nombre, i.codigo))}`}>WhatsApp</a>
                    <button className="ad-lnk" onClick={() => editar(i)}>Editar</button>
                    <button className="ad-lnk mal" onClick={() => borrar(i)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="ad-credito">Diseñado por <b>Duván Ramos</b></p>
      </main>

      {dirty && tab === "editar" && (
        <div className="ad-savebar"><span>Tienes cambios sin guardar</span><button onClick={guardar} disabled={guardando}>Guardar</button></div>
      )}

      <nav className="ad-nav" aria-label="Secciones">
        {([["resumen", "Resumen"], ["editar", "Invitación"], ["invitados", "Invitados"]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>
            <span>{k === "resumen" ? "▦" : k === "editar" ? "✎" : "☺"}</span>
            {l}
            {k === "invitados" && invs.length > 0 && <em>{invs.length}</em>}
          </button>
        ))}
      </nav>

      {toast && <div className={`ad-toast ${toast.err ? "err" : ""}`}>{toast.t}</div>}

      {modal && (
        <ModalForm
          m={modal}
          cerrar={(v) => {
            modal.res(v);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function ModalForm({ m, cerrar }: { m: { titulo: string; cuerpo?: string; campos?: { k: string; label: string; valor: string; tipo?: string }[]; si: string; no?: string }; cerrar: (v: Record<string, string> | null) => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries((m.campos || []).map((c) => [c.k, c.valor])));
  return (
    <div className="ad-modal" onClick={(e) => e.target === e.currentTarget && cerrar(null)}>
      <div className="caja" role="dialog" aria-label={m.titulo}>
        <h3>{m.titulo}</h3>
        {m.cuerpo && <p style={{ whiteSpace: "pre-line" }}>{m.cuerpo}</p>}
        {m.campos?.map((c) => (
          <label key={c.k}>{c.label}<input type={c.tipo || "text"} value={v[c.k]} onChange={(e) => setV((x) => ({ ...x, [c.k]: e.target.value }))} autoFocus={c === m.campos![0]} /></label>
        ))}
        <div className="bs">
          {m.no && <button className="ad-btn sec" onClick={() => cerrar(null)}>{m.no}</button>}
          <button className="ad-btn pri" onClick={() => cerrar(v)}>{m.si}</button>
        </div>
      </div>
    </div>
  );
}
