import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal de Gestión",
  description:
    "Portal operativo unificado: métricas, PQRSF, línea amiga, radicaciones y formación.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a17" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col font-sans text-foreground">
        <CursorSpotlight />
        {children}
      </body>
    </html>
  );
}
