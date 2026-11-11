// Utilidades PURAS y client-safe (sin `server-only`) sobre nombres de mes en
// español. Los nombres coinciden EXACTAMENTE con el array MESES de
// auditorias-admin.ts, que es lo que se guarda en la columna "mes" del
// Consolidado, para que el filtro por mes case sin ambigüedad.
export const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

// Mes en curso en zona horaria de Colombia, como nombre (p. ej. "Noviembre").
// Se calcula desde la fecha local de Bogotá para no depender de la zona del
// servidor ni del navegador.
export function mesEnCursoNombre(): string {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); // "YYYY-MM-DD"
  const idx = parseInt(iso.slice(5, 7), 10) - 1;
  return MESES_ES[idx] ?? "";
}
