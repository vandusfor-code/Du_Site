import Link from "next/link";
import { auth } from "@/auth";
import { modulosPermitidos } from "@/lib/modulos";
import { logoutAction } from "./logout/actions";

export default async function Home() {
  const session = await auth();
  const nombre = session?.user?.nombre ?? "";
  const modulos = modulosPermitidos(session?.user?.modulos ?? []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <span className="text-lg font-semibold text-slate-900">Portal de Gestión</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">
          Bienvenido, {nombre}
        </h1>
        <p className="mt-1 text-slate-500">
          Selecciona el módulo con el que deseas trabajar.
        </p>

        {modulos.length === 0 ? (
          <p className="mt-8 text-slate-500">
            No tienes módulos asignados. Contacta a un administrador.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((modulo) => (
              <Link
                key={modulo.id}
                href={modulo.href}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="mb-3 h-2 w-10 rounded-full"
                  style={{ backgroundColor: modulo.color }}
                />
                <h2 className="text-lg font-semibold text-slate-900">
                  {modulo.nombre}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{modulo.descripcion}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
