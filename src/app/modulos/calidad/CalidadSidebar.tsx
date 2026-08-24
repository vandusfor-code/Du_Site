import Link from "next/link";
import { ClipboardCheck, LogOut } from "lucide-react";

/**
 * Sidebar propio de Calidad — misma estructura/proporciones que
 * AdminSidebar (src/app/admin/AdminSidebar.tsx: 228px, fijo, marca arriba,
 * nav, perfil abajo), pero CLARO: usa las variables locales --cal-* que
 * define el contenedor raíz en CalidadDashboard.tsx (bg-[var(--cal-bg)],
 * etc.), no los tokens --brand/--brand-deep de globals.css (esos son un
 * índigo oscuro pensado para el login/home, no para un shell claro).
 * Calidad es su propio módulo (requireModulo("calidad")), no una sección
 * de /admin, así que el nav solo lista este módulo.
 */
export default function CalidadSidebar({ nombre, rol }: { nombre: string; rol?: string }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-10 flex w-[228px] flex-col border-r px-3 py-[22px]"
      style={{ background: "var(--cal-surface)", borderColor: "var(--cal-border)" }}
    >
      <div className="flex items-center gap-[11px] px-2 pb-[26px] text-[17px]">
        <div
          className="grid size-[31px] place-items-center rounded-[9px] font-black text-white"
          style={{ background: "var(--cal-accent)" }}
        >
          Du
        </div>
        <b style={{ color: "var(--cal-text-strong)" }}>Du Site</b>
      </div>

      <nav className="flex flex-col gap-[5px]">
        <span
          className="flex h-[43px] w-full items-center gap-[13px] rounded-[9px] border-l-[3px] px-3 text-[14px] font-semibold"
          style={{
            background: "var(--cal-accent-soft)",
            borderColor: "var(--cal-accent)",
            color: "var(--cal-text-strong)",
          }}
        >
          <ClipboardCheck size={19} style={{ color: "var(--cal-accent)" }} />
          Calidad
        </span>
      </nav>

      <div className="mt-auto">
        <div className="flex items-center gap-[9px] border-y px-1 py-4" style={{ borderColor: "var(--cal-border)" }}>
          <div
            className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold"
            style={{ background: "var(--cal-accent-soft)", color: "var(--cal-accent)" }}
          >
            {nombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-xs" style={{ color: "var(--cal-text-strong)" }}>
              {nombre}
            </strong>
            <small className="mt-[3px] text-[10px]" style={{ color: "var(--cal-muted-2)" }}>
              {rol || "Calidad"}
            </small>
          </div>
        </div>
        <Link
          href="/"
          className="mt-[10px] flex h-[43px] items-center gap-[13px] rounded-[9px] px-3 text-[14px] no-underline"
          style={{ color: "var(--cal-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--cal-accent-soft)";
            e.currentTarget.style.color = "var(--cal-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--cal-muted)";
          }}
        >
          <LogOut size={16} /> Volver al inicio
        </Link>
      </div>
    </aside>
  );
}
