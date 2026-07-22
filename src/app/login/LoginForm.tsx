"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock, User } from "lucide-react";
import { loginAction } from "./actions";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, formAction, pending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {/* Usuario */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="usuario"
          className="text-[13px] font-semibold text-foreground"
        >
          Usuario
        </label>
        <div className="group relative">
          <User
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint transition-colors group-focus-within:text-brand"
          />
          <input
            id="usuario"
            name="usuario"
            type="text"
            required
            autoComplete="username"
            placeholder="tu.usuario"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-11 pr-3.5 text-[14px] font-medium text-foreground outline-none transition-all placeholder:text-faint focus:border-brand focus:shadow-[0_0_0_4px_var(--accent-tint)]"
          />
        </div>
      </div>

      {/* Contraseña */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[13px] font-semibold text-foreground"
        >
          Contraseña
        </label>
        <div className="group relative">
          <Lock
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint transition-colors group-focus-within:text-brand"
          />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-11 pr-11 text-[14px] font-medium text-foreground outline-none transition-all placeholder:text-faint focus:border-brand focus:shadow-[0_0_0_4px_var(--accent-tint)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-faint transition-colors hover:bg-surface-inset hover:text-foreground"
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="animate-shake flex items-center gap-2.5 rounded-md border border-[color:var(--error)]/25 bg-error-bg px-3.5 py-2.5"
        >
          <AlertCircle size={17} className="shrink-0 text-error" />
          <p className="text-[13px] font-medium text-error">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative mt-1 flex h-11 items-center justify-center gap-2 overflow-hidden rounded-md bg-brand font-semibold text-brand-foreground shadow-[var(--shadow-brand)] transition-all hover:bg-brand-mid active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {/* lime shimmer sweep */}
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[color:var(--accent)]/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          aria-hidden="true"
        />
        {pending ? (
          <>
            <span className="spinner size-4" />
            <span className="text-[14px]">Ingresando…</span>
          </>
        ) : (
          <span className="text-[14px] text-accent">Ingresar</span>
        )}
      </button>
    </form>
  );
}
