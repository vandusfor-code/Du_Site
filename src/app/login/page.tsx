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
    <main className="flex min-h-screen w-full">
      {/* ── Brand panel ── */}
      <section className="relative hidden w-[45%] flex-col overflow-hidden bg-brand-deep lg:flex">
        {/* textured background */}
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

        <div className="relative z-10 shrink-0 p-12 pb-0">
          <BrandLogo size={46} showWordmark onDark />
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-12 py-8">
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

          {/* Floating dashboard illustration — self-contained column, no absolute drift */}
          <div className="mt-8 flex w-64 flex-col" aria-hidden="true">
            <div
              className="animate-float ml-auto w-44 rounded-xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/60">Desempeño</span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  +24.6%
                </span>
              </div>
              <svg viewBox="0 0 120 40" className="mt-3 h-10 w-full" preserveAspectRatio="none">
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
              className="animate-float -mt-6 w-36 rounded-xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: "1.3s" }}
            >
              <div className="relative mx-auto grid size-16 place-items-center">
                <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
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
                <span className="absolute text-sm font-bold text-white">84%</span>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-white/60">Casos resueltos</p>
            </div>

            <div
              className="animate-float -mt-6 ml-auto w-44 rounded-xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: "2.1s" }}
            >
              <p className="text-[11px] font-semibold text-white/70">Auditorías</p>
              <div className="mt-2 space-y-1.5 text-[11px]">
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

        <div className="relative z-10 shrink-0 space-y-4 p-12 pt-0">
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

      {/* ── Form panel ── */}
      <section className="flex w-full flex-col items-center justify-center bg-background px-6 py-10 lg:w-[55%]">
        <div className="animate-scale-in flex w-full max-w-sm flex-col items-center text-center">
          <div className="relative mb-6">
            <div
              className="animate-pulse-glow absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{ background: "radial-gradient(circle, var(--accent-tint), transparent 70%)" }}
              aria-hidden="true"
            />
            <BrandLogo size={64} />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            ¡Bienvenido de vuelta! <span aria-hidden="true">👋</span>
          </h2>
          <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-muted">
            Ingresa con tu usuario y contraseña asignados para continuar.
          </p>

          <div className="mt-8 w-full text-left">
            <LoginForm callbackUrl={callbackUrl ?? "/"} />
          </div>

          <div className="mt-8 flex items-center gap-1.5 text-[12px] font-medium text-faint">
            <ShieldCheck size={14} strokeWidth={2.2} />
            <span>Conexión segura y encriptada</span>
          </div>

          <p className="mt-4 text-center text-[12px] text-faint">
            © {year} Portal de Gestión · People BPO · v4.0
          </p>
        </div>
      </section>
    </main>
  );
}
