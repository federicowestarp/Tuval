"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import {
  bloqueado, contrasenaValida, hashContrasena, hashToken, iniciarSesion, invitacionVigente,
  problemaContrasena, registrarIntento, terminarSesion,
} from "@/lib/equipo";

export type EstadoSesion = { error?: string; correo?: string };

export async function entrar(_prev: EstadoSesion, fd: FormData): Promise<EstadoSesion> {
  const correo = String(fd.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(fd.get("contrasena") ?? "");
  if (!correo || !contrasena) return { error: "Escribe tu correo y contraseña.", correo };
  if (await bloqueado(correo)) return { error: "Demasiados intentos. Espera 15 minutos.", correo };

  const [u] = await sql<{ id: string; hash_contrasena: string }[]>`
    select id, hash_contrasena from usuarios_internos where correo = ${correo} and activo`;
  const ok = u ? await contrasenaValida(contrasena, u.hash_contrasena) : false;
  await registrarIntento(correo, ok);
  if (!u || !ok) return { error: "Correo o contraseña incorrectos.", correo };

  await iniciarSesion(u.id);
  const [{ rol }] = await sql<{ rol: string }[]>`select rol from usuarios_internos where id = ${u.id}`;
  redirect(rol === "chofer" ? "/interno/chofer" : "/interno/pedidos");
}

export async function salir() {
  await terminarSesion();
  redirect("/interno/entrar");
}

export type EstadoActivar = { error?: string; campos?: Record<string, string> };

export async function activar(_prev: EstadoActivar, fd: FormData): Promise<EstadoActivar> {
  const token = String(fd.get("token") ?? "");
  const nombre = String(fd.get("nombre") ?? "").trim();
  const correo = String(fd.get("correo") ?? "").trim().toLowerCase();
  const c1 = String(fd.get("contrasena") ?? "");
  const c2 = String(fd.get("confirmacion") ?? "");
  const campos = { nombre, correo };

  const inv = await invitacionVigente(token);
  if (!inv) return { error: "Esta invitación ya se usó o venció. Pide una nueva.", campos };
  if (nombre.length < 3) return { error: "Escribe tu nombre.", campos };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "Revisa el correo.", campos };
  const problema = problemaContrasena(c1);
  if (problema) return { error: problema, campos };
  if (c1 !== c2) return { error: "Las contraseñas no coinciden.", campos };
  const [existe] = await sql`select 1 from usuarios_internos where correo = ${correo}`;
  if (existe) return { error: "Ese correo ya tiene usuario. Entra con él.", campos };

  const h = await hashContrasena(c1);
  const id = await sql.begin(async (tx) => {
    const [u] = await tx<{ id: string }[]>`
      insert into usuarios_internos (nombre, correo, hash_contrasena, rol) values (${nombre}, ${correo}, ${h}, ${inv.rol}) returning id`;
    // Se marca usada dentro de la misma transacción: una invitación = un usuario.
    const usada = await tx`
      update invitaciones_internas set usada_en = now(), usuario_id = ${u.id}
      where token_hash = ${hashToken(token)} and usada_en is null returning 1`;
    if (usada.length === 0) throw new Error("Invitación ya usada");
    return u.id;
  });
  await iniciarSesion(id);
  redirect(inv.rol === "chofer" ? "/interno/chofer" : "/interno/pedidos");
}
