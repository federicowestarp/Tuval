"use server";

import { sql } from "@/lib/db";
import { bloqueado, contrasenaValida, hashContrasena, iniciarSesion, registrarIntento, requerirInterno, terminarSesion } from "@/lib/equipo";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN = /^\d{4,6}$/;

/**
 * Cambio rápido de usuario en la caja: solo desde un equipo que ya tiene sesión, con PIN de 4 a 6 dígitos.
 * 5 intentos fallidos en 15 minutos bloquean a ese usuario.
 */
export async function cambiarUsuario(usuarioId: string, pin: string): Promise<{ error?: string }> {
  await requerirInterno("mostrador");
  if (!UUID.test(usuarioId) || !PIN.test(pin)) return { error: "Elige tu nombre y escribe tu PIN." };
  const [u] = await sql<{ id: string; correo: string; pin_hash: string | null }[]>`
    select id, correo, pin_hash from usuarios_internos where id = ${usuarioId} and activo and rol in ('mostrador', 'supervisor', 'admin', 'operador')`;
  if (!u?.pin_hash) return { error: "Ese usuario no tiene PIN. Pídele al administrador que se lo asigne en Equipo." };
  if (await bloqueado(u.correo)) return { error: "Demasiados intentos. Espera 15 minutos." };
  const ok = await contrasenaValida(pin, u.pin_hash);
  await registrarIntento(u.correo, ok);
  if (!ok) return { error: "PIN incorrecto." };
  await terminarSesion();
  await iniciarSesion(u.id);
  refrescar("/interno/mostrador");
  return {};
}

/** El administrador asigna o cambia el PIN de un usuario. */
export async function asignarPin(fd: FormData) {
  await requerirInterno("admin");
  const id = String(fd.get("id")), pin = String(fd.get("pin") ?? "").trim();
  if (!UUID.test(id) || !PIN.test(pin)) return;
  await sql`update usuarios_internos set pin_hash = ${await hashContrasena(pin)} where id = ${id}`;
  refrescar("/interno/equipo");
}

/** Cada quien puede cambiar su propio PIN. */
export async function cambiarMiPin(pin: string): Promise<{ error?: string; ok?: boolean }> {
  const yo = await requerirInterno("mostrador");
  if (!PIN.test(pin)) return { error: "El PIN debe tener de 4 a 6 números." };
  await sql`update usuarios_internos set pin_hash = ${await hashContrasena(pin)} where id = ${yo.id}`;
  return { ok: true };
}
