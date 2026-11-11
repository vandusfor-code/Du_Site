"use client";
// Punto de entrada de /cumple/<nombre>
//   ?i=CODIGO   → invitación personal
//   ?admin=KEY  → panel del anfitrión
//   (nada)      → vista previa con los datos por defecto
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DEFAULTS, mezclar, type CumpleCfg, type Invitado } from "./config";
import { rpc } from "./api";
import Invitacion from "./Invitacion";

const Admin = dynamic(() => import("./Admin"), { ssr: false });

type Estado =
  | { t: "cargando" }
  | { t: "error"; msg: string }
  | { t: "invitado"; cfg: CumpleCfg; inv: Invitado | null; codigo: string | null; directo: boolean }
  | { t: "admin"; key: string };

export default function CumpleApp() {
  const [e, setE] = useState<Estado>({ t: "cargando" });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const admin = q.get("admin");
    const codigo = q.get("i");
    const directo = q.get("directo") === "1";
    if (admin) {
      setE({ t: "admin", key: admin });
      return;
    }
    const vista = q.get("vista");
    if (vista) {
      rpc<{ config: unknown }>("boda_admin_get", { p_key: vista })
        .then((d) => setE({ t: "invitado", cfg: mezclar(DEFAULTS, d.config), inv: null, codigo: null, directo }))
        .catch(() => setE({ t: "error", msg: "El enlace de vista previa no es válido." }));
      return;
    }
    if (!codigo) {
      setE({ t: "invitado", cfg: DEFAULTS, inv: null, codigo: null, directo });
      return;
    }
    rpc<{ config: unknown; invitado: Invitado }>("boda_invitado_get", { p_codigo: codigo })
      .then((d) => setE({ t: "invitado", cfg: mezclar(DEFAULTS, d.config), inv: d.invitado, codigo, directo }))
      .catch((err: { code?: string }) =>
        setE({
          t: "error",
          msg: err.code === "invitacion_no_encontrada" ? "Este enlace no es válido. Pídele a Duvan que te lo comparta de nuevo." : "No pudimos conectarnos. Revisa tu internet e inténtalo otra vez.",
        })
      );
  }, []);

  if (e.t === "cargando")
    return (
      <div className="cm-carga">
        <span>
          cargando
          <i />
        </span>
      </div>
    );
  if (e.t === "error")
    return (
      <div className="cm-error">
        <div>
          <h1>Enlace no válido</h1>
          <p>{e.msg}</p>
        </div>
      </div>
    );
  if (e.t === "admin") return <Admin adminKey={e.key} />;
  return <Invitacion cfg={e.cfg} inv={e.inv} codigo={e.codigo} directo={e.directo} />;
}
