"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { importarPqrsfComunicarAction } from "./actions";
import type { ResultadoImportacion } from "@/lib/pqrsf-comunicar";
import s from "./pqrsf-comunicar.module.css";

export default function PqrsfComunicarView() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function elegir(f: File | null | undefined) {
    if (!f) return;
    const nombre = f.name.toLowerCase();
    if (!nombre.endsWith(".xls") && !nombre.endsWith(".xlsx")) {
      setError("Formato no compatible. Sube un archivo .xls o .xlsx.");
      return;
    }
    setError(null);
    setResultado(null);
    setArchivo(f);
  }

  async function importar() {
    if (!archivo || importando) return;
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await importarPqrsfComunicarAction(fd);
      if (r.ok) setResultado(r);
      else setError(r.error ?? "No fue posible completar la importación.");
    } catch {
      setError("No fue posible completar la importación.");
    } finally {
      setImportando(false);
    }
  }

  function limpiar() {
    setArchivo(null);
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={s.page}>
      <div className={s.shell}>
        <Link href="/" className={s.back}><ArrowLeft size={14} /> Volver al inicio</Link>

        <header className={s.head}>
          <div className={s.title}><Upload size={24} /><h1>PQRSF Por comunicar</h1></div>
          <p>Registro e importación de PQRSF pendientes por comunicar.</p>
        </header>

        <section className={s.card}>
          {resultado ? (
            <div className={s.resumen}>
              <div className={s.resumenIcon}><CheckCircle2 size={30} /></div>
              <h2>Importación completada</h2>
              <div className={s.resumenLineas}>
                <div><b>{resultado.encontrados ?? 0}</b> registros encontrados</div>
                <div><b>{resultado.registrados ?? 0}</b> registrados correctamente</div>
                {(resultado.omitidos ?? 0) > 0 && (
                  <div className={s.omitidos}><b>{resultado.omitidos}</b> omitidos porque ya existían</div>
                )}
              </div>
              {(resultado.duplicados?.length ?? 0) > 0 && (
                <details className={s.duplicados}>
                  <summary>Ver radicados repetidos ({resultado.duplicados!.length})</summary>
                  <ul>
                    {resultado.duplicados!.map((r, i) => (
                      <li key={`${r}-${i}`}>{r}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button className={s.primary} onClick={limpiar} type="button">Importar otro archivo</button>
            </div>
          ) : (
            <>
              <div
                className={`${s.dropzone} ${arrastrando ? s.dropzoneActiva : ""} ${archivo ? s.dropzoneConArchivo : ""}`}
                onClick={() => !importando && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (!importando) setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  if (!importando) elegir(e.dataTransfer.files?.[0]);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  hidden
                  onChange={(e) => elegir(e.target.files?.[0])}
                />
                {archivo ? (
                  <div className={s.archivo}>
                    <div className={s.archivoIcon}><FileSpreadsheet size={22} /></div>
                    <div className={s.archivoInfo}>
                      <b>{archivo.name}</b>
                      <span>{(archivo.size / 1024).toFixed(0)} KB</span>
                    </div>
                    {!importando && (
                      <button className={s.quitar} onClick={(e) => { e.stopPropagation(); limpiar(); }} type="button" aria-label="Quitar">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className={s.dropIcon}><Upload size={26} /></div>
                    <b>Arrastra el archivo aquí o haz clic para seleccionarlo</b>
                    <span>Archivos .xls o .xlsx descargados del sistema de PQRSF</span>
                  </>
                )}
              </div>

              {error && <div className={s.error}><AlertTriangle size={16} /> {error}</div>}

              <div className={s.acciones}>
                <button className={s.primary} onClick={importar} disabled={!archivo || importando} type="button">
                  {importando ? <><Loader2 size={16} className={s.spin} /> Importando…</> : <><Upload size={16} /> Importar registros</>}
                </button>
              </div>

              <p className={s.nota}>
                Solo se agregan filas nuevas a la hoja de PQRSF. Los radicados ya existentes se omiten y no se
                modifica ningún dato anterior.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
