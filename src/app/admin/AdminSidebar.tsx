"use client";

import Link from "next/link";
import {
  LayoutDashboard, ClipboardCheck, FileSearch, Users, CircleGauge, Send,
  FileBarChart, Bell, Settings, ChevronDown, LogOut, type LucideIcon,
} from "lucide-react";
import styles from "./auditorias.module.css";

interface ItemNav {
  icon: LucideIcon;
  label: string;
  href?: string;
}

const NAV: ItemNav[] = [
  { icon: LayoutDashboard, label: "Resumen" },
  { icon: ClipboardCheck, label: "Auditorías", href: "/admin" },
  { icon: FileSearch, label: "Auditoría Documental", href: "/admin/documental" },
  { icon: Users, label: "Asesores" },
  { icon: CircleGauge, label: "Criterios" },
  { icon: Send, label: "Cortes de envío" },
  { icon: FileBarChart, label: "Reportes" },
  { icon: Bell, label: "Alertas" },
  { icon: Settings, label: "Configuración" },
];

export default function AdminSidebar({ nombre, activo }: { nombre: string; activo: string }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>Du</div>
        <b>Du Site</b>
      </div>
      <nav className={styles.nav}>
        {NAV.map(({ icon: Icon, label, href }) => {
          const cls = label === activo ? styles.navActive : styles.navItem;
          return href ? (
            <Link key={label} href={href} className={cls} style={{ textDecoration: "none" }}>
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ) : (
            <button key={label} type="button" className={cls}>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.profile}>
          <div className={styles.avatar}>{nombre.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{nombre}</strong>
            <small>Administrador</small>
          </div>
          <ChevronDown size={16} />
        </div>
        <Link href="/" className={styles.collapse}>
          <LogOut size={16} /> Volver al inicio
        </Link>
      </div>
    </aside>
  );
}
