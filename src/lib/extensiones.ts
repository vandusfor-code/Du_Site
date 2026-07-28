import "server-only";
import { readRange } from "@/lib/sheets";
import type { ExtensionRegistro, ExtensionesData } from "@/lib/extensiones-tipos";

// ============================================================
// Extensiones: directorio de extensiones telefónicas de la organización.
//
// Fuente real (cuando SHEET_ID_EXTENSIONES esté configurada): una hoja con
// columnas ITEM | ÁREA | CARGO | EXTENSIÓN | NOMBRE | HORARIO DE ATENCIÓN.
// Una misma extensión puede tener varias personas asociadas — cada persona
// es su propia fila y el número de extensión puede repetirse.
//
// La fuente real NO trae columnas de "Estado" ni "Uso": se derivan en
// extensiones-tipos.ts a partir del texto real de NOMBRE (ver agruparPorExtension).
// Mientras SHEET_ID_EXTENSIONES no esté configurada, se sirve el set de
// ejemplo entregado en el mockup, para validar la UI.
// ============================================================

const TAB = "EXTENCIONES";

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString().trim();
}

const DATOS_EJEMPLO: ExtensionRegistro[] = [
  { id: "ej-1", extension: "3999", nombre: "Sandra Milena", cargo: "Asistente", area: "Dirección Administrativa", horario: ["Lun-Mar: 7:00–12:00 / 2:00–6:00", "Mié-Vie: 7:00–12:00 / 2:00–5:00"] },
  { id: "ej-2", extension: "3998", nombre: "Claudia Mora", cargo: "Secretaría", area: "Dirección Administrativa", horario: ["Lun-Mar: 7:00–12:00 / 2:00–6:00", "Mié-Vie: 7:00–12:00 / 2:00–5:00"] },
  { id: "ej-3", extension: "3828", nombre: "Catalina Gutierrez", cargo: "Línea Directa", area: "Dirección Administrativa", horario: ["Lun-Mar: 7:00–12:00 / 2:00–6:00", "Mié-Vie: 7:00–12:00 / 2:00–5:00"] },
  { id: "ej-4", extension: "3827", nombre: "Policarpa Pardo", cargo: "Línea Directa", area: "Consejo Directivo", horario: ["Lun-Mar: 7:00–12:00 / 2:00–6:00", "Mié-Vie: 7:00–12:00 / 2:00–5:00"] },
  { id: "ej-5", extension: "3994", nombre: "Juan Jose Gonzalez", cargo: "Secretaría", area: "Revisoría Fiscal", horario: ["Lun: 8:00 a 1:00 / 2:00–5:00", "Mar-Vier: 7:30–1:00 / 2:00–5:00"] },
  { id: "ej-6", extension: "3993", nombre: "Yineth Paz", cargo: "Delegado", area: "Revisoría Fiscal", horario: ["Lun: 8:00 a 1:00 / 2:00–5:00", "Mar-Vier: 7:30–1:00 / 2:00–5:00"] },
  { id: "ej-7", extension: "3826", nombre: "Camila Mayorga", cargo: "Línea Directa", area: "Revisoría Fiscal", horario: ["Lun: 8:00 a 1:00 / 2:00–5:00", "Mar-Vier: 7:30–1:00 / 2:00–5:00"] },
  { id: "ej-8", extension: "3991", nombre: "Angela Granada", cargo: "Secretaría", area: "Auditoría", horario: ["Lun-Mar: 7:00–12:00 / 2:00–6:00", "Mié-Vie: 7:00–12:00 / 2:00–5:00"] },
];

export async function obtenerExtensiones(): Promise<ExtensionesData> {
  const id = process.env.SHEET_ID_EXTENSIONES;
  if (!id) {
    return { registros: DATOS_EJEMPLO, conectado: false };
  }

  const filas = await readRange(id, `${TAB}!A2:F`);
  const registros: ExtensionRegistro[] = [];
  let i = 0;
  for (const f of filas) {
    if (!texto(f, 3)) continue; // sin número de extensión, se descarta

    const area = texto(f, 1);
    const cargo = texto(f, 2);
    const extension = texto(f, 3);
    const horario = texto(f, 5)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Cuando varias personas comparten una extensión, a veces vienen en la
    // MISMA fila con los nombres separados por salto de línea dentro de la
    // celda (en vez de una fila por persona). Se separan en registros propios.
    const nombres = texto(f, 4)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (nombres.length === 0) {
      registros.push({ id: `${extension}-${i++}`, area, cargo, extension, nombre: "", horario });
    } else {
      for (const nombre of nombres) {
        registros.push({ id: `${extension}-${i++}`, area, cargo, extension, nombre, horario });
      }
    }
  }

  return { registros, conectado: true };
}
