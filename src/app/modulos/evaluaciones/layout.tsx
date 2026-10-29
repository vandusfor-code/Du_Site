// Fuerza TEMA CLARO en todo el módulo Evaluaciones, sin importar el modo oscuro
// del sistema (el fondo global de Du Site cambia a oscuro con prefers-color-scheme
// dark; aquí lo fijamos claro para esta sección). Una sola fuente para todas las
// pantallas (gestión y asesora).
export default function EvaluacionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#f5f6fa", color: "#18202d", colorScheme: "light" }}>
      {children}
    </div>
  );
}
