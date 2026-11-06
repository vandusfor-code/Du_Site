import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ETIQUETA_NOVEDAD } from "@/lib/empleo/pila-tipos";
import { MONEDA, type VistaResultado } from "./empleo-vista";

const MORADO: [number, number, number] = [79, 70, 229];
const VERDE: [number, number, number] = [22, 131, 75];
const ROJO: [number, number, number] = [214, 69, 69];
const AMBAR: [number, number, number] = [180, 83, 9];

function colorEstado(estado: string): [number, number, number] {
  return estado === "CUMPLE" ? VERDE : estado === "NO_CUMPLE" ? ROJO : AMBAR;
}
function etiquetaEstado(estado: string): string {
  return estado === "CUMPLE" ? "CUMPLE" : estado === "NO_CUMPLE" ? "NO CUMPLE" : "REQUIERE REVISIÓN";
}

export function generarInformePdf(v: VistaResultado): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // Encabezado institucional.
  doc.setFillColor(...MORADO);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("INFORME DE VALIDACIÓN DE APORTES PILA", M, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Gestión de empleo · Mecanismo de Protección al Cesante · COFREM", M, 48);

  let y = 92;
  doc.setTextColor(30, 34, 51);

  // Resultado.
  const ce = colorEstado(v.estado);
  doc.setFillColor(ce[0], ce[1], ce[2]);
  doc.roundedRect(M, y, W - M * 2, 34, 6, 6, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(`RESULTADO: ${etiquetaEstado(v.estado)}`, M + 14, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`${v.diasAcreditados} / ${v.diasRequeridos} días`, W - M - 14, y + 22, { align: "right" });
  y += 50;
  doc.setTextColor(30, 34, 51);

  // Datos.
  const info: [string, string][] = [
    ["Trabajador", v.trabajadorNombre],
    ["Documento", v.trabajadorDocumento],
    ["Tipo de trabajador", v.tipoTrabajador === "dependiente" ? "Dependiente" : "Independiente"],
    ["Fecha de solicitud", v.fechaSolicitud],
    ["Periodo evaluado", `${v.ventana.desde} a ${v.ventana.hasta}`],
    ["Días requeridos", String(v.diasRequeridos)],
    ["Días acreditados", String(v.diasAcreditados)],
    ["Diferencia", `${v.diasDiferencia >= 0 ? "+" : ""}${v.diasDiferencia} días`],
    ["Asesor", v.asesorNombre],
    ["Archivo", v.archivoNombre],
    ["Motor de reglas", v.versionMotor],
    ["Generado", new Date().toLocaleString("es-CO")],
  ];
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    body: info, theme: "plain",
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130, textColor: [110, 116, 130] }, 1: { textColor: [30, 34, 51] } },
  });
  // @ts-expect-error lastAutoTable lo agrega el plugin
  y = doc.lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(90, 96, 110);
  doc.text(doc.splitTextToSize(v.motivo, W - M * 2), M, y + 4);
  y += 24;

  // Detalle por periodo.
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 34, 51);
  doc.text("Detalle de aportes por periodo", M, y);
  autoTable(doc, {
    startY: y + 6, margin: { left: M, right: M },
    head: [["Periodo", "Empresa (NIT)", "Reg.", "Días rep.", "Días rec.", "Aporte total", "Estado"]],
    body: v.resumenPorPeriodo.map((p) => [
      p.periodo, p.nits.join(", "), String(p.registros), String(p.diasReportados),
      String(p.diasReconocidos), MONEDA.format(p.aporteAcumulado),
      p.estado === "contabilizado" ? "Contabilizado" : "Excluido",
    ]),
    headStyles: { fillColor: MORADO, fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [247, 247, 252] },
  });
  // @ts-expect-error plugin
  y = doc.lastAutoTable.finalY + 14;

  // Inconsistencias.
  if (v.inconsistencias.length > 0) {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Inconsistencias y observaciones", M, y);
    autoTable(doc, {
      startY: y + 6, margin: { left: M, right: M },
      head: [["Nivel", "Periodo", "Detalle"]],
      body: v.inconsistencias.map((i) => [i.nivel.toUpperCase(), i.periodo ?? "—", i.mensaje]),
      headStyles: { fillColor: AMBAR, fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 2: { cellWidth: "auto" } },
    });
    // @ts-expect-error plugin
    y = doc.lastAutoTable.finalY + 14;
  }

  // Novedades detectadas (informativas).
  const novedadesPresentes = Array.from(new Set(v.resumenPorPeriodo.flatMap((p) => p.novedades)));
  if (novedadesPresentes.length > 0) {
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 96, 110);
    doc.text(`Novedades detectadas (informativas, no descuentan días): ${novedadesPresentes.map((n) => ETIQUETA_NOVEDAD[n]).join(", ")}.`, M, y, { maxWidth: W - M * 2 });
    y += 20;
  }

  // Observaciones.
  if (y > 700) { doc.addPage(); y = 50; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 34, 51);
  doc.text("Observaciones", M, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(70, 76, 90);
  doc.text(doc.splitTextToSize(`Automática: ${v.observacionAuto || "—"}`, W - M * 2), M, y);
  y += doc.splitTextToSize(`Automática: ${v.observacionAuto || "—"}`, W - M * 2).length * 11 + 6;
  if (v.observacionAsesor) {
    doc.text(doc.splitTextToSize(`Del asesor: ${v.observacionAsesor}`, W - M * 2), M, y);
    y += doc.splitTextToSize(`Del asesor: ${v.observacionAsesor}`, W - M * 2).length * 11 + 6;
  }

  // Nota legal + numeración.
  const total = doc.getNumberOfPages();
  const nota = "Este informe constituye un apoyo para la verificación de los aportes y no reemplaza la validación oficial de requisitos ni la decisión administrativa de COFREM.";
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(140, 146, 160);
    doc.text(doc.splitTextToSize(nota, W - M * 2), M, H - 34);
    doc.text(`Página ${i} de ${total}`, W - M, H - 16, { align: "right" });
  }

  const nombre = `Validacion_PILA_${(v.trabajadorDocumento || "trabajador").replace(/\W/g, "")}_${v.fechaSolicitud}.pdf`;
  doc.save(nombre);
}
