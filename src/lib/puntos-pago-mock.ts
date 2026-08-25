import type { PuntoPago } from "@/lib/puntos-pago-tipos";

// Datos de demostración para la UI. Solo se usan si no se pueden leer las
// hojas de Google Sheets (Puntos-Retiros y SuperGIROS).

const HORARIO_TIPICO = "Lunes a Domingo\n6:00 a.m. - 9:00 p.m.";

const SEMILLA: Omit<PuntoPago, "id">[] = [
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Velilla #2", direccion: "CL 38 43 78", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Paseo Bolívar La 43", direccion: "CL 34 43 2", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Centro Cívico", direccion: "CL 37 45 17", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Clínica Centro", direccion: "CL 40 41 134", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "CDA Velilla", direccion: "CL 38 41 100", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "La Bomba", direccion: "KR 38 33 18", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "CDA Boliche", direccion: "CL 30 38 02", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "CDA Caribe", direccion: "CL 72 41B 147", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Antiguo CDA 76", direccion: "KR 46 75 131", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Centro Comercial Único", direccion: "CL 74 46 100", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Mercado Público", direccion: "CL 9 6 15", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Parque Bolívar", direccion: "CL 35 44 20", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Calle 84", direccion: "CL 84 42 10", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "El Prado", direccion: "CL 53 54 21", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Riomar", direccion: "CL 85 51 12", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Villa Country", direccion: "CL 78 55 8", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Boston", direccion: "CL 45 38 22", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "San Felipe", direccion: "KR 21 41 6", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Alto Prado", direccion: "CL 76 54 30", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Las Nieves", direccion: "CL 45 41 18", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Terminal de Transportes", direccion: "CL 1 35 25", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "La Cuarenta", direccion: "CL 40 38 12", horario: null, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Portal del Prado", direccion: "CL 53 46 90", horario: null, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Atlántico", ciudad: "Barranquilla", nombre: "Metrocentro", direccion: "CL 74 50 12", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Soledad", nombre: "Centro Soledad", direccion: "CL 18 23 10", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Atlántico", ciudad: "Soledad", nombre: "Plaza Soledad", direccion: "KR 16 30 4", horario: null, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Atlántico", ciudad: "Soledad", nombre: "Villa Estadio", direccion: "CL 30 16 22", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Bolívar", ciudad: "Cartagena", nombre: "Centro Histórico", direccion: "CL 32 4 15", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Bolívar", ciudad: "Cartagena", nombre: "Bocagrande", direccion: "KR 3 5 20", horario: null, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Bolívar", ciudad: "Cartagena", nombre: "Bazurto", direccion: "CL 31 29 8", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Antioquia", ciudad: "Medellín", nombre: "Parque Berrío", direccion: "CL 50 51 20", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Antioquia", ciudad: "Medellín", nombre: "El Poblado", direccion: "CL 10 43 10", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Antioquia", ciudad: "Medellín", nombre: "La Candelaria", direccion: "KR 52 48 12", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Cundinamarca", ciudad: "Bogotá", nombre: "Chapinero", direccion: "CL 63 10 18", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Cundinamarca", ciudad: "Bogotá", nombre: "Centro Internacional", direccion: "KR 7 26 20", horario: HORARIO_TIPICO, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Cundinamarca", ciudad: "Bogotá", nombre: "Restrepo", direccion: "KR 19 15 6", horario: null, latitud: null, longitud: null },
  { red: "SuperGIROS", departamento: "Valle del Cauca", ciudad: "Cali", nombre: "San Antonio", direccion: "CL 5 10 12", horario: null, latitud: null, longitud: null },
  { red: "Efecty", departamento: "Valle del Cauca", ciudad: "Cali", nombre: "Centro Cali", direccion: "CL 11 5 30", horario: null, latitud: null, longitud: null },
];

export const PUNTOS_PAGO_MOCK: PuntoPago[] = SEMILLA.map((p, i) => ({
  ...p,
  id: `mock-${String(i + 1).padStart(3, "0")}`,
}));
