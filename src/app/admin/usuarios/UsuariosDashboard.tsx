"use client";

import { useState } from "react";
import { Users, UserPlus, Loader2, X, KeyRound, Pencil, ShieldCheck } from "lucide-react";
import type { UsuarioAdmin } from "@/lib/usuarios-admin";
import type { Rol } from "@/lib/usuarios";
import type { Modulo } from "@/lib/modulos";
import AdminSidebar from "../AdminSidebar";
import {
  listarUsuariosAction,
  crearUsuarioAction,
  actualizarUsuarioAction,
  restablecerPasswordAction,
} from "./actions";
import styles from "../auditorias.module.css";

const ROLES: Rol[] = ["Admin", "Coordinadora", "Asesora"];

interface FormUsuario {
  usuario: string;
  nombre: string;
  password: string;
  rol: Rol;
  activo: boolean;
  modulos: string[];
}

function formVacio(): FormUsuario {
  return { usuario: "", nombre: "", password: "", rol: "Asesora", activo: true, modulos: [] };
}

export default function UsuariosDashboard({
  nombre,
  usuariosIniciales,
  errorInicial,
  modulos,
}: {
  nombre: string;
  usuariosIniciales: UsuarioAdmin[];
  errorInicial: string | null;
  modulos: Modulo[];
}) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>(usuariosIniciales);
  const [error] = useState(errorInicial);
  const [banner, setBanner] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Modal: "crear" | "editar" | null
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [form, setForm] = useState<FormUsuario>(formVacio());
  const [editandoUsuario, setEditandoUsuario] = useState<string>("");

  async function refrescar() {
    setCargando(true);
    try {
      setUsuarios(await listarUsuariosAction());
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al recargar" });
    } finally {
      setCargando(false);
    }
  }

  function abrirCrear() {
    setForm(formVacio());
    setModal("crear");
  }

  function abrirEditar(u: UsuarioAdmin) {
    setEditandoUsuario(u.usuario);
    setForm({ usuario: u.usuario, nombre: u.nombre, password: "", rol: u.rol, activo: u.activo, modulos: [...u.modulos] });
    setModal("editar");
  }

  function toggleModulo(id: string) {
    setForm((f) => ({ ...f, modulos: f.modulos.includes(id) ? f.modulos.filter((m) => m !== id) : [...f.modulos, id] }));
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setBanner(null);
    try {
      let res;
      if (modal === "crear") {
        res = await crearUsuarioAction({
          usuario: form.usuario, nombre: form.nombre, password: form.password,
          modulos: form.modulos, rol: form.rol, activo: form.activo,
        });
      } else {
        res = await actualizarUsuarioAction(editandoUsuario, {
          nombre: form.nombre, modulos: form.modulos, rol: form.rol, activo: form.activo,
        });
      }
      if (res.ok) {
        setBanner({ tipo: "ok", msg: modal === "crear" ? `Usuario "${form.usuario}" creado.` : `Usuario "${editandoUsuario}" actualizado.` });
        setModal(null);
        await refrescar();
      } else {
        setBanner({ tipo: "error", msg: res.error });
      }
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(u: UsuarioAdmin) {
    setBanner(null);
    try {
      const res = await actualizarUsuarioAction(u.usuario, { activo: !u.activo });
      if (res.ok) { setBanner({ tipo: "ok", msg: `${u.usuario} ${u.activo ? "desactivado" : "activado"}.` }); await refrescar(); }
      else setBanner({ tipo: "error", msg: res.error });
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" });
    }
  }

  async function resetearPassword(u: UsuarioAdmin) {
    const nueva = window.prompt(`Nueva contraseña para "${u.usuario}" (mínimo 6 caracteres):`);
    if (nueva === null) return;
    setBanner(null);
    try {
      const res = await restablecerPasswordAction(u.usuario, nueva);
      setBanner(res.ok ? { tipo: "ok", msg: `Contraseña de ${u.usuario} actualizada.` } : { tipo: "error", msg: res.error });
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" });
    }
  }

  const nombreModulo = (id: string) => modulos.find((m) => m.id === id)?.nombre ?? id;

  return (
    <div className={styles.app}>
      <AdminSidebar nombre={nombre} activo="Usuarios" />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.titleLine}><Users size={25} /><h1>Usuarios</h1></div>
            <p>Crea usuarios, define roles y controla a qué módulos accede cada quien.</p>
          </div>
          <div className={styles.topActions}>
            <div className={styles.actionRow}>
              <button className={styles.primary} onClick={abrirCrear}><UserPlus size={16} /> Crear usuario</button>
            </div>
          </div>
        </header>

        {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
        {banner && <div className={`${styles.banner} ${banner.tipo === "ok" ? styles.bannerOk : styles.bannerError}`}>{banner.msg}</div>}

        <section className={`${styles.panel} ${styles.history}`}>
          <h2><Users size={18} /> {usuarios.length} usuario(s) {cargando && <Loader2 size={15} className={styles.spin} />}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Módulos</th><th></th></tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={6} className={styles.emptyRow}>No hay usuarios.</td></tr>
                ) : usuarios.map((u) => (
                  <tr key={u.usuario}>
                    <td><b>{u.usuario}</b></td>
                    <td>{u.nombre}</td>
                    <td>
                      <span className={styles.rolBadge} data-rol={u.rol}>
                        {u.rol === "Admin" && <ShieldCheck size={12} />} {u.rol}
                      </span>
                    </td>
                    <td><span className={u.activo ? styles.ok : styles.penc}>{u.activo ? "Activo" : "Inactivo"}</span></td>
                    <td><span className={styles.modulosCount}>{u.modulos.length}</span> <small style={{ color: "#8a93a8" }}>{u.modulos.slice(0, 3).map(nombreModulo).join(", ")}{u.modulos.length > 3 ? "…" : ""}</small></td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={styles.view} onClick={() => abrirEditar(u)}><Pencil size={14} /> Editar</button>
                        <button className={styles.view} onClick={() => toggleActivo(u)}>{u.activo ? "Desactivar" : "Activar"}</button>
                        <button className={styles.view} onClick={() => resetearPassword(u)}><KeyRound size={14} /> Clave</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {modal && (
        <div className={styles.overlay} onClick={() => !guardando && setModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div><small>{modal === "crear" ? "Nuevo usuario" : "Editar usuario"}</small><h3>{modal === "crear" ? "Crear usuario" : form.usuario}</h3></div>
              <button className={styles.closeBtn} onClick={() => setModal(null)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                {modal === "crear" && (
                  <div className={styles.formField}>
                    <label>Usuario (login) *</label>
                    <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="ej. J.PEREZ123" />
                  </div>
                )}
                <div className={styles.formField}>
                  <label>Nombre *</label>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                {modal === "crear" && (
                  <div className={styles.formField}>
                    <label>Contraseña * (mín. 6)</label>
                    <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="contraseña inicial" />
                  </div>
                )}
                <div className={styles.formField}>
                  <label>Rol</label>
                  <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label>Estado</label>
                  <select value={form.activo ? "SI" : "NO"} onChange={(e) => setForm({ ...form, activo: e.target.value === "SI" })}>
                    <option value="SI">Activo</option>
                    <option value="NO">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className={styles.formField} style={{ marginTop: 6 }}>
                <label>Módulos a los que tiene acceso</label>
                <div className={styles.modulosGrid}>
                  {modulos.map((m) => (
                    <label key={m.id} className={styles.moduloCheck}>
                      <input type="checkbox" checked={form.modulos.includes(m.id)} onChange={() => toggleModulo(m.id)} />
                      {m.nombre}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formActions} style={{ marginTop: 16 }}>
                <button className={styles.secondary} onClick={() => setModal(null)} disabled={guardando}>Cancelar</button>
                <button className={styles.primary} onClick={guardar} disabled={guardando}>
                  {guardando ? <Loader2 size={16} className={styles.spin} /> : null} {modal === "crear" ? "Crear" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
