"use server";

import { sql } from "@/lib/db";

/** El cliente deja su celular para que le avisemos cuando consigamos la pieza que buscó en la tienda. */
export async function dejarCelular(solicitudId: string, telefono: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitudId)) return { error: "No se pudo guardar." };
  const tel = String(telefono ?? "").replace(/\D/g, "").slice(-10);
  if (tel.length !== 10) return { error: "Escribe tu celular a 10 dígitos." };
  await sql`update solicitudes_producto set contacto_telefono = ${tel} where id = ${solicitudId} and origen = 'buscador_tienda' and creado_en > now() - interval '2 days'`;
  return {};
}
