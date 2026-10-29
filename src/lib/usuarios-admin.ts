import "server-only";
import bcrypt from "bcryptjs";
import { readRange, appendRows, updateRange } from "@/lib/sheets";
import { normalizarRol, type Rol } from "@/lib/usuarios";

// ============================================================
// Gestión de usuarios (módulo Admin) — interfaz sobre la hoja Usuarios.
//
// Columnas (A2:F): A Usuario · B Contraseña(hash bcrypt) · C Nombre ·
// D Módulos (separados por coma) · E Activo (SI/NO) · F Rol.
//
// Disciplina de seguridad (esta hoja controla el LOGIN de todos):
//  - Crear = SOLO append de una fila nueva.
//  - Actualizar = updateRange de celdas puntuales de UNA fila ya localizada.
//  - NUNCA se reescribe toda la hoja ni se toca el encabezado (fila 1).
//  - La contraseña se guarda SIEMPRE cifrada con bcrypt; el hash jamás sale al
//    cliente (listarUsuarios no lo devuelve).
// ============================================================

const SALT_ROUNDS = 10;

function sheetId(): string {
  const id = process.env.SHEET_ID_USUARIOS;
  if (!id) throw new Error("Falta la variable SHEET_ID_USUARIOS");
  return id;
}

function texto(row: unknown[], i: number): string {
  return (row[i] ?? "").toString();
}

export interface UsuarioAdmin {
  fila: number; // número de fila real en la hoja (para actualizaciones)
  usuario: string;
  nombre: string;
  modulos: string[];
  activo: boolean;
  rol: Rol;
}

export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const data = await readRange(sheetId(), "Usuarios!A2:F");
  const out: UsuarioAdmin[] = [];
  for (let i = 0; i < data.length; i++) {
    const f = data[i];
    const usuario = texto(f, 0).trim();
    if (!usuario) continue;
    out.push({
      fila: i + 2, // A2 es la primera fila de datos
      usuario,
      nombre: texto(f, 2).trim() || usuario,
      modulos: texto(f, 3).split(",").map((m) => m.trim()).filter(Boolean),
      activo: texto(f, 4).trim().toUpperCase() !== "NO",
      rol: normalizarRol(texto(f, 5)),
    });
  }
  return out;
}

// Localiza la fila (número real) de un usuario por su login, sin distinguir
// mayúsculas. Devuelve -1 si no existe.
async function filaDeUsuario(usuario: string): Promise<number> {
  const col = await readRange(sheetId(), "Usuarios!A2:A");
  const objetivo = usuario.trim().toLowerCase();
  for (let i = 0; i < col.length; i++) {
    if (texto(col[i], 0).trim().toLowerCase() === objetivo) return i + 2;
  }
  return -1;
}

export interface NuevoUsuarioInput {
  usuario: string;
  nombre: string;
  password: string;
  modulos: string[];
  rol: Rol;
  activo: boolean;
}

export async function crearUsuarioAdmin(input: NuevoUsuarioInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const usuario = (input.usuario ?? "").trim();
  const nombre = (input.nombre ?? "").trim();
  const password = (input.password ?? "").trim();

  if (!usuario) return { ok: false, error: "El usuario es obligatorio." };
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

  if ((await filaDeUsuario(usuario)) !== -1) {
    return { ok: false, error: `Ya existe un usuario "${usuario}".` };
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const modulos = (input.modulos ?? []).map((m) => m.trim()).filter(Boolean).join(", ");

  await appendRows(sheetId(), "Usuarios!A:F", [[
    usuario,
    hash,
    nombre,
    modulos,
    input.activo ? "SI" : "NO",
    normalizarRol(input.rol),
  ]]);

  return { ok: true };
}

export interface CambiosUsuario {
  nombre?: string;
  modulos?: string[];
  rol?: Rol;
  activo?: boolean;
}

// Actualiza C..F (nombre, módulos, activo, rol) de una fila. NO toca A ni B.
export async function actualizarUsuarioAdmin(usuario: string, cambios: CambiosUsuario): Promise<{ ok: true } | { ok: false; error: string }> {
  const fila = await filaDeUsuario(usuario);
  if (fila === -1) return { ok: false, error: `No existe el usuario "${usuario}".` };

  // Lee los valores actuales de C..F para no pisar lo que no se cambia.
  const actual = await readRange(sheetId(), `Usuarios!C${fila}:F${fila}`);
  const f = actual[0] ?? [];
  const nombreActual = texto(f, 0);
  const modulosActual = texto(f, 1);
  const activoActual = texto(f, 2);
  const rolActual = texto(f, 3);

  const nombre = cambios.nombre !== undefined ? cambios.nombre.trim() : nombreActual;
  if (!nombre) return { ok: false, error: "El nombre no puede quedar vacío." };
  const modulos = cambios.modulos !== undefined ? cambios.modulos.map((m) => m.trim()).filter(Boolean).join(", ") : modulosActual;
  const activo = cambios.activo !== undefined ? (cambios.activo ? "SI" : "NO") : (activoActual || "SI");
  const rol = cambios.rol !== undefined ? normalizarRol(cambios.rol) : normalizarRol(rolActual);

  await updateRange(sheetId(), `Usuarios!C${fila}:F${fila}`, [[nombre, modulos, activo, rol]]);
  return { ok: true };
}

export async function restablecerPasswordAdmin(usuario: string, nuevaPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = (nuevaPassword ?? "").trim();
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  const fila = await filaDeUsuario(usuario);
  if (fila === -1) return { ok: false, error: `No existe el usuario "${usuario}".` };
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await updateRange(sheetId(), `Usuarios!B${fila}`, [[hash]]);
  return { ok: true };
}
