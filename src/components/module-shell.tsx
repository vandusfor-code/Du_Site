"use client";

import Link from "next/link";
import "./module-shell.css";

export function BackHomeLink() {
  return (
    <Link href="/" className="du-topbar-back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Volver al inicio
    </Link>
  );
}

export function SoundToggleButton({ soundOn, toggleSound }: { soundOn: boolean; toggleSound: () => void }) {
  return (
    <button
      type="button"
      className="du-sound-btn"
      data-off={!soundOn}
      onClick={toggleSound}
      aria-label={soundOn ? "Silenciar sonido" : "Activar sonido"}
      title={soundOn ? "Silenciar sonido" : "Activar sonido"}
    >
      {soundOn ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M23 9l-6 6M17 9l6 6" />
        </svg>
      )}
    </button>
  );
}

export function ModuleTopbar({
  moduleName,
  soundOn,
  toggleSound,
}: {
  moduleName: string;
  soundOn: boolean;
  toggleSound: () => void;
}) {
  return (
    <div className="du-topbar">
      <BackHomeLink />
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase" }}>
        {moduleName}
      </span>
      <SoundToggleButton soundOn={soundOn} toggleSound={toggleSound} />
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="du-toast">{message}</div>;
}

export function FullScreenAlert({
  title,
  message,
  onDismiss,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="du-alert-overlay">
      <div className="du-alert-card">
        <div className="du-alert-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </div>
        <div className="du-alert-eyebrow">ALERTA DE HORARIO</div>
        <div className="du-alert-title">{title}</div>
        <div className="du-alert-msg">{message}</div>
        <button type="button" className="du-alert-btn" onClick={onDismiss}>
          Entendido
        </button>
      </div>
    </div>
  );
}
