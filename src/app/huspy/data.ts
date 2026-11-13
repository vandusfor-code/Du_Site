// ============================================================
// Datos de la jornada de formación Huspy. Catálogo REAL de propiedades/asesores
// y casos de práctica (direcciones y teléfonos FICTICIOS, marcados como tales).
// No mezclar propiedades con asesores que no correspondan.
// ============================================================

export const ASESORAS = ["Daniela", "Candela", "Bleidis", "Adriana"] as const;
export type Asesora = (typeof ASESORAS)[number];

// Catálogo oficial: cada propiedad con su precio y su asesor responsable.
export interface Propiedad {
  titulo: string;
  precio: number; // en euros
  asesor: string;
  extra: string;
}

export const CATALOGO: Propiedad[] = [
  { titulo: "Terreno en Venta en Valdemoro", precio: 149000, asesor: "Carmen Redondo", extra: "23.215 m²" },
  { titulo: "Terreno en Venta en Calle Gloria Fuertes", precio: 450000, asesor: "Fabio Ismael Masdeu Rodriguez", extra: "1.088 m²" },
  { titulo: "Local en venta - San Sebastián de los Reyes", precio: 331000, asesor: "Iago García Vaquero", extra: "374 m²" },
  { titulo: "Apartamento en planta baja de diseño llave en mano en Fuengirola, Málaga", precio: 695000, asesor: "Evelyne De Carlo", extra: "121 m², 2 habitaciones" },
  { titulo: "Piso en venta - Mijas", precio: 185000, asesor: "Melania Rawat Molina", extra: "63 m², 1 habitación" },
];

export const ASESORES = CATALOGO.map((p) => p.asesor);

export function fmtPrecio(n: number): string {
  return n.toLocaleString("es-ES") + " €";
}

// Guion OFICIAL de transferencia Huspy — NO modificar, resumir ni inventar otro.
export const GUION_PARTES = [
  { fijo: "Hola, " },
  { campo: "asesor" as const, etiqueta: "nombre del asesor" },
  { fijo: ", te saludamos del call center de Huspy. Tenemos en línea a " },
  { campo: "cliente" as const, etiqueta: "nombre del cliente" },
  { fijo: ", que está interesado en tu propiedad de " },
  { campo: "calle" as const, etiqueta: "calle" },
  { fijo: ", en " },
  { campo: "ciudad" as const, etiqueta: "ciudad/zona" },
  { fijo: ", de " },
  { campo: "precio" as const, etiqueta: "precio" },
  { fijo: ". " },
  { campo: "contexto" as const, etiqueta: "contexto" },
  { fijo: " ¿Te pasamos la llamada?" },
];

export type CampoGuion = "asesor" | "cliente" | "calle" | "ciudad" | "precio" | "contexto";
