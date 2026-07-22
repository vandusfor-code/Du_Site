"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="flex flex-col gap-1">
        <label htmlFor="usuario" className="text-sm font-medium text-slate-700">
          Usuario
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          required
          autoComplete="username"
          className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
