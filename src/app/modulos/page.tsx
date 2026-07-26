import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { modulosPermitidos } from "@/lib/modulos";
import { MODULO_VISUALS } from "@/components/module-icons";
import s from "./modulos.module.css";

export default async function TodosLosModulosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Solo los módulos realmente autorizados por la sesión. Nunca se listan otros.
  const modulos = modulosPermitidos(session.user.modulos ?? []);

  return (
    <div className={s.page}>
      <div className={s.shell}>
        <Link href="/" className={s.back}>
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <header className={s.head}>
          <h1>Todos tus módulos</h1>
          <p>Accede a las herramientas disponibles en tu espacio de trabajo.</p>
        </header>

        <section className={s.grid}>
          {modulos.map((m) => {
            const visual = MODULO_VISUALS[m.id];
            const Icon = visual.icon;
            return (
              <Link key={m.id} href={m.href} className={s.card}>
                <span className={s.icon} style={{ background: visual.accentBg, color: visual.accentFg }}>
                  <Icon size={26} />
                </span>
                <h3>{m.nombre}</h3>
                <p>{m.descripcion}</p>
                <span className={s.go}>
                  <ArrowRight size={16} />
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
