import { readRange } from "./sheets";

export interface Usuario {
  usuario: string;
  passwordHash: string;
  nombre: string;
  modulos: string[];
  activo: boolean;
}

const SHEET_ID = process.env.SHEET_ID_USUARIOS;
// Usuario | PasswordHash | Nombre | Modulos (separados por coma) | Activo (SI/NO)
const RANGE = "Usuarios!A2:E";

export async function buscarUsuario(usuario: string): Promise<Usuario | null> {
  if (!SHEET_ID) {
    throw new Error("Falta la variable SHEET_ID_USUARIOS");
  }

  const filas = await readRange(SHEET_ID, RANGE);

  const fila = filas.find(
    (f) => (f[0] ?? "").toString().trim().toLowerCase() === usuario.trim().toLowerCase()
  );

  if (!fila) return null;

  const [usuarioCol, passwordHash, nombre, modulosCol, activoCol] = fila;
  const usuarioStr = (usuarioCol ?? "").toString();

  return {
    usuario: usuarioStr,
    passwordHash: (passwordHash ?? "").toString(),
    nombre: (nombre ?? usuarioStr).toString(),
    modulos: (modulosCol ?? "")
      .toString()
      .split(",")
      .map((m: string) => m.trim())
      .filter(Boolean),
    activo: (activoCol ?? "").toString().trim().toUpperCase() !== "NO",
  };
}
