"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import AdminSidebar from "../AdminSidebar";
import ConfigIAPanel from "../ConfigIAPanel";
import styles from "../auditorias.module.css";

export default function ConfiguracionDashboard({ nombre }: { nombre: string }) {
  const [banner, setBanner] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);

  return (
    <div className={styles.app}>
      <AdminSidebar nombre={nombre} activo="Configuración" />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.titleLine}><Settings size={25} /><h1>Configuración</h1></div>
            <p>Ajustes del sistema. Aquí defines el motor de IA y la API key con la que se auditan las transcripciones.</p>
          </div>
        </header>

        {banner && (
          <div className={`${styles.banner} ${banner.tipo === "ok" ? styles.bannerOk : styles.bannerError}`} style={{ margin: "0 0 16px" }}>
            {banner.msg}
          </div>
        )}

        <div style={{ maxWidth: 680 }}>
          <ConfigIAPanel onBanner={(m) => setBanner(m)} />
        </div>
      </main>
    </div>
  );
}
