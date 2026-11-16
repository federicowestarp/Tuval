"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { crearInvitacion, requerirInterno } from "@/lib/equipo";
import { urlBase } from "@/lib/url";

export type EstadoInvitar = { liga?: string; rol?: string; error?: string };

export async function invitar(_prev: EstadoInvitar, fd: FormData): Promise<EstadoInvitar> {
  const yo = await requerirInterno("admin");
  const rol = String(fd.get("rol")) === "admin" ? "admin" : "operador";
  const token = await crearInvitacion(rol, yo.id);
  return { liga: `${await urlBase()}/interno/activar/${token}`, rol };
}

export async function cambiarActivo(fd: FormData) {
  const yo = await requerirInterno("admin");
  const id = String(fd.get("id"));
  if (id === yo.id) return; // nadie se da de baja a sí mismo
  const activo = fd.get("activo") === "1";
  await sql`update usuarios_internos set activo = ${activo} where id = ${id}`;
  if (!activo) await sql`delete from sesiones_internas where usuario_id = ${id}`;
  revalidatePath("/interno/equipo");
}
