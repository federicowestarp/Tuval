"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { refrescar } from "@/lib/refrescar";
import { momento } from "@/lib/momento";
import { PUNTOS_RECORRIDO, type PuntoRegistrado } from "@/lib/recorrido";

/** Guarda un recorrido de tienda terminado: qué estaba bien y qué no (con nota). */
export async function guardarRecorrido(d: { iniciado: string; puntos: PuntoRegistrado[]; terminado?: string }): Promise<{ error?: string }> {
  const yo = await requerirInterno("mostrador");
  const validos = new Set<string>(PUNTOS_RECORRIDO.map((p) => p.id));
  const puntos = (d.puntos ?? []).filter((p) => validos.has(p.id)).map((p) => ({ id: p.id, ok: !!p.ok, nota: p.ok ? undefined : String(p.nota ?? "").trim().slice(0, 200) || undefined }));
  if (puntos.length < PUNTOS_RECORRIDO.length) return { error: "Revisa todos los puntos antes de terminar." };
  const sinNota = puntos.filter((p) => !p.ok && !p.nota);
  if (sinNota.length) return { error: "Escribe qué estaba mal en los puntos marcados con problema." };
  const inicio = new Date(d.iniciado);
  const iniciado = Number.isFinite(inicio.getTime()) && Date.now() - inicio.getTime() < 75 * 3600 * 1000 ? inicio : new Date();
  const fd = new FormData();
  if (d.terminado) fd.set("_ocurrido", d.terminado);
  const terminado = momento(fd);
  await sql`insert into recorridos_tienda (usuario_id, iniciado_en, terminado_en, puntos, problemas)
            values (${yo.id}, ${iniciado}, ${terminado}, ${sql.json(puntos)}, ${puntos.filter((p) => !p.ok).length})`;
  for (const r of ["/interno/recorrido", "/interno/mostrador", "/interno/vender"]) refrescar(r);
  return {};
}
