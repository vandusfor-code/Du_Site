import { ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import LoginForm from "./LoginForm";

const HIGHLIGHTS = [
  {
    icon: TrendingUp,
    title: "Métricas en tiempo real",
    desc: "Desempeño, bonos y auditorías siempre a la vista.",
  },
  {
    icon: Sparkles,
    title: "Búsqueda con IA",
    desc: "Clasifica y resuelve casos PQRSF en segundos.",
  },
  {
    icon: ShieldCheck,
    title: "Operación centralizada",
    desc: "Radicaciones, línea amiga y formación en un solo lugar.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const year = new Date().getFullYear();

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-brand-deep">
      {/* shared background texture — one color across the whole page */}
      <div className="dot-grid absolute inset-0 opacity-70" aria-hidden="true" />
      <div
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, var(--brand-soft), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full opacity-20 blur-3xl animate-float"
        style={{
          background: "radial-gradient(circle, var(--accent), transparent 70%)",
          animationDelay: "1.5s",
        }}
        aria-hidden="true"
      />

      {/* ── Brand panel ── */}
      <section className="relative z-10 hidden w-[45%] flex-col lg:flex">
        <div className="shrink-0 p-12 pb-0">
          <BrandLogo size={46} showWordmark onDark />
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center px-12 py-8">
          <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Portal operativo
          </span>
          <h1 className="mt-4 max-w-md text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white">
            Excelencia operativa, todo en un solo lugar.
          </h1>
          <p className="mt-4 max-w-sm text-pretty text-[15px] leading-relaxed text-white/60">
            Unifica métricas, gestión de casos y formación de tu equipo BPO en
            una plataforma pensada para jornadas largas.
          </p>

          {/* Floating dashboard illustration — one tight row, no drift */}
          <div className="mt-7 flex flex-wrap items-end gap-3" aria-hidden="true">
            <div
              className="animate-float w-28 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="relative mx-auto grid size-14 place-items-center">
                <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="81.8 97.4"
                  />
                </svg>
                <span className="absolute text-[13px] font-bold text-white">84%</span>
              </div>
              <p className="mt-1.5 text-center text-[10px] font-medium text-white/60">Casos resueltos</p>
            </div>

            <div
              className="animate-float w-36 shrink-0 -translate-y-4 rounded-xl border border-white/10 bg-white/[0.06] p-3.5 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: "1.1s" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/60">Desempeño</span>
                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                  +24.6%
                </span>
              </div>
              <svg viewBox="0 0 120 40" className="mt-2 h-9 w-full" preserveAspectRatio="none">
                <polyline
                  points="0,32 20,26 40,30 60,14 80,20 100,6 120,10"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div
              className="animate-float w-32 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-3.5 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: "1.8s" }}
            >
              <p className="text-[10px] font-semibold text-white/70">Auditorías</p>
              <div className="mt-1.5 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-white/50">Hoy</span>
                  <span className="font-bold text-white">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Esta semana</span>
                  <span className="font-bold text-white">48</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Pendientes</span>
                  <span className="font-bold text-accent">7</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-4 p-12 pt-0">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="animate-enter flex items-start gap-3.5"
              style={{ animationDelay: `${0.3 + i * 0.12}s` }}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/50">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Form panel — a card floating on the same background ── */}
      <section className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[55%] lg:justify-start lg:pt-20">
        <div className="animate-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div
                className="animate-pulse-glow absolute inset-0 -z-10 rounded-full blur-2xl"
                style={{ background: "radial-gradient(circle, var(--accent-tint), transparent 70%)" }}
                aria-hidden="true"
              />
              <BrandLogo size={64} onDark />
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              ¡Bienvenido de vuelta! <span aria-hidden="true">👋</span>
            </h2>
            <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-white/60">
              Ingresa con tu usuario y contraseña asignados para continuar.
            </p>

            <div className="mt-8 w-full text-left">
              <LoginForm callbackUrl={callbackUrl ?? "/"} />
            </div>

            <div className="mt-8 flex items-center gap-1.5 text-[12px] font-medium text-white/40">
              <ShieldCheck size={14} strokeWidth={2.2} />
              <span>Conexión segura y encriptada</span>
            </div>

            <p className="mt-4 text-center text-[12px] text-white/35">
              © {year} Portal de Gestión · People BPO · v4.0
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
