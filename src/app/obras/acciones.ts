"use server";

import { sql } from "@/lib/db";
import { ESTADOS } from "@/lib/corte";

export type EstadoContacto = { error?: string; ok?: boolean; campos?: Record<string, string> };

export async function enviarContacto(_prev: EstadoContacto, fd: FormData): Promise<EstadoContacto> {
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const campos = { nombre: t("nombre"), empresa: t("empresa"), telefono: t("telefono"), correo: t("correo"), mensaje: t("mensaje"), entidad: t("entidad") };
  if (t("sitio")) return { ok: true }; // trampa para robots: campo oculto que una persona no llena
  if (campos.nombre.length < 3) return { error: "Escribe tu nombre.", campos };
  const tel = campos.telefono.replace(/\D/g, "");
  if (tel.length !== 10) return { error: "El teléfono debe tener 10 dígitos.", campos };
  if (!(ESTADOS as readonly string[]).includes(campos.entidad)) return { error: "Elige el estado de la obra.", campos };
  if (campos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo)) return { error: "Revisa el correo.", campos };
  const tipo = t("tipo") === "obra" ? "obra" : "contacto";
  const [r] = await sql<{ n: number }[]>`select count(*)::int n from contactos_web where telefono = ${tel} and creado_en > now() - interval '1 hour'`;
  if (r.n >= 3) return { ok: true }; // ya lo tenemos; evita repetidos
  await sql`
    insert into contactos_web (tipo, nombre, empresa, telefono, correo, mensaje, entidad)
    values (${tipo}, ${campos.nombre.slice(0, 120)}, ${campos.empresa.slice(0, 120) || null}, ${tel}, ${campos.correo || null}, ${campos.mensaje.slice(0, 2000) || null}, ${campos.entidad})`;
  return { ok: true };
}
