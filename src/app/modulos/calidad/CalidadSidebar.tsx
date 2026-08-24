import Link from "next/link";
import { ClipboardCheck, LogOut } from "lucide-react";

/**
 * Sidebar propio de Calidad — misma estructura/proporciones que
 * AdminSidebar (src/app/admin/AdminSidebar.tsx), pero coloreado con los
 * tokens canónicos de globals.css (--brand/--brand-deep/--accent) en vez
 * de la paleta hex propia de auditorias.module.css. Calidad es su propio
 * módulo (requireModulo("calidad")), no una sección de /admin, así que
 * el nav solo lista este módulo — no se inventan enlaces a secciones de
 * Auditorías que Calidad no tiene.
 */
export default function CalidadSidebar({ nombre, rol }: { nombre: string; rol?: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-[228px] flex-col bg-gradient-to-b from-[var(--brand)] to-[var(--brand-deep)] px-3 py-[22px] text-white/85">
      <div className="flex items-center gap-[11px] px-2 pb-[26px] text-[17px]">
        <div className="grid size-[31px] place-items-center rounded-[9px] bg-white font-black text-[var(--brand)] shadow-[inset_0_0_0_3px_var(--brand-soft)]">
          Du
        </div>
        <b className="text-white">Du Site</b>
      </div>

      <nav className="flex flex-col gap-[5px]">
        <span className="flex h-[43px] w-full items-center gap-[13px] rounded-[9px] border-l-[3px] border-accent bg-white/10 px-3 text-[14px] font-semibold text-white">
          <ClipboardCheck size={19} />
          Calidad
        </span>
      </nav>

      <div className="mt-auto">
        <div className="flex items-center gap-[9px] border-y border-white/10 px-1 py-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-extrabold text-white">
            {nombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-xs text-white">{nombre}</strong>
            <small className="mt-[3px] text-[10px] text-white/55">{rol || "Calidad"}</small>
          </div>
        </div>
        <Link
          href="/"
          className="mt-[10px] flex h-[43px] items-center gap-[13px] rounded-[9px] px-3 text-[14px] text-white/70 no-underline hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} /> Volver al inicio
        </Link>
      </div>
    </aside>
  );
}
