"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { obtenerOCrearCuenta, cuentaActual } from "@/lib/sesion";
import { guardarArchivo, TIPOS_IMAGEN } from "@/lib/archivos";
import { ZONAS, type Zona } from "@/lib/corte";

export type EstadoDireccion = { error?: string; campos?: Record<string, string> };
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function guardarDireccion(_prev: EstadoDireccion, fd: FormData): Promise<EstadoDireccion> {
  const campos = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)]));
  const falla = (error: string) => ({ error, campos });

  const tipo = t(fd, "tipo");
  const alias = t(fd, "alias");
  const direccion = t(fd, "direccion");
  const zona = t(fd, "zona") as Zona;
  const recibeNombre = t(fd, "recibe_nombre");
  const recibeTel = t(fd, "recibe_telefono").replace(/\D/g, "");
  const pref = t(fd, "preferencia_contacto");
  const lat = Number(t(fd, "lat")) || null;
  const lng = Number(t(fd, "lng")) || null;

  if (tipo !== "obra" && tipo !== "particular") return falla("Elige si es obra o dirección particular.");
  if (alias.length < 2) return falla("Ponle un nombre para reconocerla (ej. Obra Lomas, Casa).");
  if (direccion.length < 10) return falla("Escribe la dirección completa.");
  if (!ZONAS.some((z) => z.id === zona)) return falla("Elige la zona.");
  if (recibeNombre.length < 3) return falla("¿Quién recibe en ese lugar?");
  if (recibeTel.length !== 10) return falla("El teléfono de quien recibe debe tener 10 dígitos.");
  if (pref !== "whatsapp" && pref !== "telefono") return falla("Elige cómo contactar a quien recibe.");
  if (lat != null && (lat < 14 || lat > 33 || lng == null || lng < -118 || lng > -86)) return falla("La ubicación del mapa no es válida.");

  const cuenta = await obtenerOCrearCuenta();
  let fotoId: string | null;
  try {
    fotoId = await guardarArchivo(fd.get("foto"), TIPOS_IMAGEN, cuenta.id);
  } catch (e) {
    return falla((e as Error).message);
  }

  await sql`
    insert into direcciones (cuenta_id, tipo, alias, direccion, zona, lat, lng, foto_archivo_id, recibe_nombre,
                             recibe_telefono, preferencia_contacto, permite_sin_recepcion, indicaciones)
    values (${cuenta.id}, ${tipo}, ${alias}, ${direccion}, ${zona}, ${lat}, ${lng}, ${fotoId}, ${recibeNombre},
            ${recibeTel}, ${pref}, ${fd.get("permite_sin_recepcion") === "on"}, ${t(fd, "indicaciones") || null})`;

  const volver = t(fd, "volver");
  redirect(volver === "/carrito" ? "/carrito" : "/cuenta/direcciones");
}

export async function borrarDireccion(fd: FormData) {
  const cuenta = await cuentaActual();
  if (!cuenta) return;
  await sql`update direcciones set activa = false where id = ${String(fd.get("id"))} and cuenta_id = ${cuenta.id}`;
  revalidatePath("/cuenta/direcciones");
}
