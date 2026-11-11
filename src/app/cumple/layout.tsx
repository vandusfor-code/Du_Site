import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./cumple.css";

const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz", "SOFT"], variable: "--cm-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--cm-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duacademy.site"),
  title: "THE NEXT CHAPTER · Cumpleaños de Duvan",
  description: "Una invitación interactiva para celebrar una nueva vuelta al sol.",
  robots: { index: false, follow: false },
  openGraph: { title: "THE NEXT CHAPTER · Cumpleaños de Duvan", description: "Abre tu invitación… ¿o miedo?", type: "website", images: [{ url: "/cumple/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "THE NEXT CHAPTER · Cumpleaños de Duvan", description: "Abre tu invitación… ¿o miedo?", images: ["/cumple/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#FBF6EC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CumpleLayout({ children }: { children: React.ReactNode }) {
  return <div className={`cm-root ${serif.variable} ${mono.variable}`}>{children}</div>;
}
