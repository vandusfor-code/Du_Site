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
      <section className="relative hidden w-[45%] overflow-hidden bg-brand-deep lg:flex lg:flex-col lg:justify-between">
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

        <div className="relative z-10 p-12">
          <BrandLogo size={46} showWordmark onDark />
        </div>

        <div className="relative z-10 px-12 pb-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-accent">
            Portal operativo
          </p>
          <h1 className="mt-4 max-w-md text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white">
            Excelencia operativa, todo en un solo lugar.
          </h1>
          <p className="mt-4 max-w-sm text-pretty text-[15px] leading-relaxed text-white/60">
            Unifica métricas, gestión de casos y formación de tu equipo BPO en
            una plataforma pensada para jornadas largas.
          </p>
        </div>

        <div className="relative z-10 space-y-3 p-12 pt-8">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="animate-enter flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
              style={{ animationDelay: `${0.3 + i * 0.12}s` }}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white/10 text-accent">
                <Icon size={20} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Form panel ── */}
      <section className="flex w-full flex-col items-center justify-center bg-background px-6 py-10 lg:w-[55%]">
        <div className="animate-scale-in w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo size={44} showWordmark />
          </div>

          <div className="mb-8 hidden lg:block">
            <BrandLogo size={40} />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            Bienvenido de vuelta
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            Ingresa con tu usuario y contraseña asignados para continuar.
          </p>

          <div className="mt-8">
            <LoginForm callbackUrl={callbackUrl ?? "/"} />
          </div>

          <p className="mt-10 text-center text-[12px] text-faint">
            © {year} Portal de Gestión · People BPO · v4.0
          </p>
        </div>
      </section>
    </main>
  );
}
