"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Download } from "lucide-react";
import { UserMenu } from "@/components/home-view";
import { useToast } from "@/lib/use-toast";
import type { FiltrosPuntosPago, OrdenPuntosPago, PuntoPago } from "@/lib/puntos-pago-tipos";
import {
  FILAS_POR_PAGINA,
  ciudadesDe,
  departamentosDe,
  etiquetaContexto,
  filtrarPuntos,
  hayConsultaActiva,
  ordenarPuntos,
  redesDe,
  textoParaCompartir,
} from "@/lib/puntos-pago-tipos";
import { PuntosPagoFiltros } from "./PuntosPagoFiltros";
import { PuntosPagoResultados } from "./PuntosPagoResultados";
import { PuntosPagoDetalle } from "./PuntosPagoDetalle";
import "./puntos-pago.css";

const FILTROS_INICIALES: FiltrosPuntosPago = {
  q: "",
  departamento: "Todos",
  ciudad: "Todos",
  red: "Todas",
};

export function PuntosPagoView({
  nombre,
  puntos,
  fuente,
  avisos = [],
  logoutAction,
}: {
  nombre: string;
  puntos: PuntoPago[];
  fuente: "sheets" | "mock";
  avisos?: string[];
  logoutAction: () => void;
}) {
  const { toast, showToast } = useToast();
  const [filtros, setFiltros] = useState<FiltrosPuntosPago>(FILTROS_INICIALES);
  const [orden, setOrden] = useState<OrdenPuntosPago>("nombre-asc");
  const [pagina, setPagina] = useState(1);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const departamentos = useMemo(() => departamentosDe(puntos), [puntos]);
  const ciudades = useMemo(() => ciudadesDe(puntos, filtros.departamento), [puntos, filtros.departamento]);
  const redes = useMemo(() => redesDe(puntos), [puntos]);

  const consultaActiva = hayConsultaActiva(filtros);

  const filtrados = useMemo(() => {
    if (!consultaActiva) return [];
    return ordenarPuntos(filtrarPuntos(puntos, filtros), orden);
  }, [puntos, filtros, orden, consultaActiva]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginaPuntos = filtrados.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA);

  const seleccionado = filtrados.find((p) => p.id === seleccionadoId) ?? null;
  const etiqueta = etiquetaContexto(filtrados, filtros);

  function actualizarFiltros(next: Partial<FiltrosPuntosPago>) {
    setFiltros((prev) => ({ ...prev, ...next }));
    setPagina(1);
    setSeleccionadoId(null);
  }

  function limpiar() {
    setFiltros(FILTROS_INICIALES);
    setPagina(1);
    setSeleccionadoId(null);
    setOrden("nombre-asc");
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      showToast("Dirección copiada");
    } catch {
      showToast("No se pudo copiar la dirección");
    }
  }

  async function compartir(punto: PuntoPago) {
    const texto = textoParaCompartir(punto);
    try {
      if (navigator.share) {
        await navigator.share({ title: punto.nombre, text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      showToast("Datos del punto copiados");
    } catch {
      /* el usuario canceló compartir */
    }
  }

  async function exportarExcel() {
    const filas = consultaActiva ? filtrados : [];
    if (filas.length === 0) {
      showToast("No hay puntos para exportar. Realiza una búsqueda primero.");
      return;
    }
    const XLSX = await import("xlsx");
    const hoja = XLSX.utils.json_to_sheet(
      filas.map((p) => ({
        "Punto de pago": p.nombre,
        Dirección: p.direccion,
        Ciudad: p.ciudad,
        Departamento: p.departamento,
        Red: p.red,
        Horario: p.horario ?? "Horario no disponible",
      }))
    );
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Puntos de pago");
    XLSX.writeFile(libro, "puntos-de-pago.xlsx");
  }

  return (
    <div className="dusite-home">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">Du</div>
          <div>
            <b>Du Site</b>
            <span>Portal de Gestión</span>
          </div>
        </div>
        <nav>
          <Link href="/">
            <button type="button">Inicio</button>
          </Link>
          <Link href="/#pendientes">
            <button type="button">Mi jornada</button>
          </Link>
          <Link href="/calendario">
            <button type="button">Calendario</button>
          </Link>
        </nav>
        <div style={{ display: "flex", alignItems: "center", justifySelf: "end", gap: 12 }}>
          <Link href="/#pendientes" className="bell" title="Notificaciones">
            <Bell size={20} />
          </Link>
          <UserMenu nombre={nombre} logoutAction={logoutAction} />
        </div>
      </header>

      <div className="dusite-pp">
        <nav className="pp-crumb" aria-label="Miga de pan">
          <Link href="/">Inicio</Link>
          <i><ChevronRight size={12} /></i>
          <span>Puntos de pago</span>
        </nav>

        <header className="pp-head">
          <div>
            <h1>Puntos de pago</h1>
            <p>Busca y consulta los puntos de pago disponibles por ciudad o municipio.</p>
          </div>
          <button type="button" className="pp-outline" onClick={exportarExcel}>
            <Download size={17} /> Exportar Excel
          </button>
        </header>

        {fuente === "mock" && (
          <div className="pp-aviso">
            Mostrando datos de ejemplo — todavía no se pudo leer las hojas de Puntos de pago.
          </div>
        )}
        {avisos.map((aviso) => (
          <div className="pp-aviso" key={aviso}>{aviso}</div>
        ))}

        <PuntosPagoFiltros
          filtros={filtros}
          departamentos={departamentos}
          ciudades={ciudades}
          redes={redes}
          onChange={actualizarFiltros}
        />

        <div className={`pp-workspace${consultaActiva ? "" : " pp-solo"}`}>
          <PuntosPagoResultados
            consultaActiva={consultaActiva}
            etiqueta={etiqueta}
            total={filtrados.length}
            orden={orden}
            onOrden={(o) => {
              setOrden(o);
              setPagina(1);
            }}
            pagina={paginaActual}
            onPagina={setPagina}
            paginaPuntos={paginaPuntos}
            seleccionadoId={seleccionado?.id ?? null}
            onSeleccionar={(p) => setSeleccionadoId(p.id)}
            onCopiar={copiar}
            onCompartir={compartir}
            onLimpiar={limpiar}
          />

          {consultaActiva && (
            <div className="pp-detailDesktop">
              <PuntosPagoDetalle punto={seleccionado} onCerrar={() => setSeleccionadoId(null)} />
            </div>
          )}
        </div>

        {seleccionado && consultaActiva && (
          <div className="pp-overlay" onClick={() => setSeleccionadoId(null)}>
            <div className="pp-sheet" onClick={(e) => e.stopPropagation()}>
              <PuntosPagoDetalle punto={seleccionado} onCerrar={() => setSeleccionadoId(null)} />
            </div>
          </div>
        )}

        {toast && <div className="pp-toast">{toast}</div>}
      </div>
    </div>
  );
}
