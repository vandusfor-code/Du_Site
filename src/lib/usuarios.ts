// NOTA: NO importamos "./sheets" (y por lo tanto googleapis) de forma estática.
// auth.ts importa este módulo, y la ruta /api/auth se usa también para CERRAR
// sesión y para validar la sesión. googleapis tiene un import muy costoso (arma
// un índice enorme de APIs al evaluarse); cargarlo estáticamente hacía que hasta
// el logout pagara ese arranque. Con el import dinámico dentro de buscarUsuario,
// googleapis solo se evalúa cuando alguien REALMENTE inicia sesión.

// Rol oficial del usuario, leído de la columna F de la hoja "Usuarios".
// "Admin" = coordinador/administrador; "Asesora" = usuaria estándar.
// Cualquier valor desconocido o vacío se normaliza a "Asesora" (nunca Admin).
export type Rol = "Admin" | "Asesora";

export function normalizarRol(valor: unknown): Rol {
  return (valor ?? "").toString().trim().toLowerCase() === "admin" ? "Admin" : "Asesora";
}

export interface Usuario {
  usuario: string;
  passwordHash: string;
  nombre: string;
  modulos: string[];
  activo: boolean;
  rol: Rol;
}

const SHEET_ID = process.env.SHEET_ID_USUARIOS;
// Usuario | PasswordHash | Nombre | Modulos (separados por coma) | Activo (SI/NO) | Rol (Admin/Asesora)
const RANGE = "Usuarios!A2:F";

export async function buscarUsuario(usuario: string): Promise<Usuario | null> {
  if (!SHEET_ID) {
    throw new Error("Falta la variable SHEET_ID_USUARIOS");
  }

  const { readRange } = await import("./sheets");
  const filas = await readRange(SHEET_ID, RANGE);

  const fila = filas.find(
    (f) => (f[0] ?? "").toString().trim().toLowerCase() === usuario.trim().toLowerCase()
  );

  if (!fila) return null;

  const [usuarioCol, passwordHash, nombre, modulosCol, activoCol, rolCol] = fila;
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
    rol: normalizarRol(rolCol),
  };
}
